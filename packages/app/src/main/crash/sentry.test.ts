import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isPackaged: true,
  testMode: false,
  userData: '',
  init: vi.fn(),
  close: vi.fn(async () => true),
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.isPackaged;
    },
    getPath: () => mocks.userData,
    getName: () => 'Electron Fiddle',
    getVersion: () => '1.0.0',
    whenReady: async () => undefined,
  },
}));
vi.mock('@sentry/electron/main', () => {
  const integration = () => ({});
  return {
    init: mocks.init,
    close: mocks.close,
    IPCMode: { Classic: 1 },
    sentryMinidumpIntegration: integration,
    electronBreadcrumbsIntegration: integration,
    electronContextIntegration: integration,
    additionalContextIntegration: integration,
    childProcessIntegration: integration,
    onUncaughtExceptionIntegration: integration,
    onUnhandledRejectionIntegration: integration,
    mainProcessSessionIntegration: integration,
    eventFiltersIntegration: integration,
    functionToStringIntegration: integration,
    linkedErrorsIntegration: integration,
    dedupeIntegration: integration,
    nodeContextIntegration: integration,
    normalizePathsIntegration: integration,
  };
});
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../test-mode', () => ({ isTestMode: () => mocks.testMode }));

const rendererCrash = {
  tags: { 'event.environment': 'native', 'event.process': 'renderer' },
};

/** A fresh module per test: `enabled` is module state. */
async function load() {
  vi.resetModules();
  return import('./sentry');
}

function writeSettings(text: string): void {
  fs.writeFileSync(path.join(mocks.userData, 'settings.json'), text);
}

type BeforeSend = (event: object) => object | null;

function beforeSend(): BeforeSend {
  return (mocks.init.mock.calls[0]![0] as { beforeSend: BeforeSend }).beforeSend;
}

beforeEach(() => {
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-sentry-'));
  mocks.isPackaged = true;
  mocks.testMode = false;
  mocks.init.mockClear();
  mocks.close.mockClear();
});

afterEach(() => {
  fs.rmSync(mocks.userData, { recursive: true, force: true });
});

describe('initCrashReporting', () => {
  it('starts Sentry when every gate is open, with no settings file', async () => {
    const { initCrashReporting } = await load();
    expect(initCrashReporting()).toBe(true);
    expect(mocks.init).toHaveBeenCalledOnce();
    expect(mocks.init.mock.calls[0]![0]).toMatchObject({
      sendDefaultPii: false,
      defaultIntegrations: false,
    });
  });

  it.each([
    ['an unpackaged app', () => void (mocks.isPackaged = false)],
    ['test mode', () => void (mocks.testMode = true)],
    [
      'the setting turned off',
      () => writeSettings('{"schemaVersion":1,"crashReports":false}'),
    ],
  ])('stays off for %s', async (_name, close) => {
    close();
    const { initCrashReporting } = await load();
    expect(initCrashReporting()).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it('stays off for headless mode', async () => {
    const { initCrashReporting } = await load();
    expect(initCrashReporting(true)).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it('keeps the setting turned off when settings.json is corrupt and only the backup has it', async () => {
    writeSettings('{"crashReports":');
    fs.writeFileSync(
      path.join(mocks.userData, 'settings.json.bak'),
      '{"schemaVersion":1,"crashReports":false}',
    );
    const { initCrashReporting } = await load();
    initCrashReporting();
    expect(mocks.init).not.toHaveBeenCalled();
    expect(fs.readdirSync(mocks.userData).sort()).toEqual([
      'settings.json',
      'settings.json.bak',
    ]);
  });

  it('falls back to the default (on) for a corrupt file or a value of the wrong type', async () => {
    writeSettings('{"crashReports":');
    let { initCrashReporting } = await load();
    initCrashReporting();
    expect(mocks.init).toHaveBeenCalledOnce();

    mocks.init.mockClear();
    writeSettings('{"crashReports":"no"}');
    ({ initCrashReporting } = await load());
    initCrashReporting();
    expect(mocks.init).toHaveBeenCalledOnce();
  });
});

describe('applyCrashReportsSetting', () => {
  it('closes Sentry when the setting is turned off, and ignores turning it on', async () => {
    const { initCrashReporting, applyCrashReportsSetting } = await load();
    initCrashReporting();
    expect(applyCrashReportsSetting(true)).toBe(true);
    expect(mocks.close).not.toHaveBeenCalled();

    expect(applyCrashReportsSetting(false)).toBe(false);
    expect(mocks.close).toHaveBeenCalledOnce();
    applyCrashReportsSetting(false);
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});

describe('native crash dumps', () => {
  it('are never sent: they hold process memory, which can contain fiddle code', async () => {
    const { initCrashReporting } = await load();
    initCrashReporting();
    expect(beforeSend()(rendererCrash)).toBeNull();
  });
});
