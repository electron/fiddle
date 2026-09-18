import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isPackaged: true,
  sentryFlag: true,
  userData: '',
  init: vi.fn(),
  close: vi.fn(async () => true),
  showMessageBox: vi.fn(),
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
  dialog: { showMessageBox: mocks.showMessageBox },
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
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../test-mode', () => ({ testFlags: () => ({ sentry: mocks.sentryFlag }) }));

const originalArgv = process.argv;
const rendererCrash = {
  tags: { 'event.environment': 'native', 'event.process': 'renderer' },
};

/** A fresh module per test: `enabled` and the consent queue are module state. */
async function load() {
  vi.resetModules();
  return import('./sentry');
}

function writeSettings(text: string): void {
  fs.writeFileSync(path.join(mocks.userData, 'settings.json'), text);
}

type BeforeSend = (event: object) => Promise<object | null>;

function beforeSend(): BeforeSend {
  return (mocks.init.mock.calls[0]![0] as { beforeSend: BeforeSend }).beforeSend;
}

beforeEach(() => {
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-sentry-'));
  mocks.isPackaged = true;
  mocks.sentryFlag = true;
  mocks.init.mockClear();
  mocks.close.mockClear();
  mocks.showMessageBox.mockReset().mockResolvedValue({ response: 1 });
  process.argv = ['electron', 'main.js'];
});

afterEach(() => {
  process.argv = originalArgv;
  fs.rmSync(mocks.userData, { recursive: true, force: true });
});

describe('initCrashReporting', () => {
  it('starts Sentry when every gate is open, with no settings file', async () => {
    const { initCrashReporting, isCrashReportingEnabled } = await load();
    initCrashReporting();
    expect(mocks.init).toHaveBeenCalledOnce();
    expect(isCrashReportingEnabled()).toBe(true);
    expect(mocks.init.mock.calls[0]![0]).toMatchObject({
      sendDefaultPii: false,
      defaultIntegrations: false,
    });
  });

  it.each([
    ['an unpackaged app', () => void (mocks.isPackaged = false)],
    ['test mode', () => void (mocks.sentryFlag = false)],
    [
      'headless mode',
      () => void (process.argv = ['electron', 'main.js', '--headless', 'run']),
    ],
    [
      'the setting turned off',
      () => writeSettings('{"schemaVersion":1,"crashReports":false}'),
    ],
  ])('stays off for %s', async (_name, close) => {
    close();
    const { initCrashReporting, isCrashReportingEnabled } = await load();
    initCrashReporting();
    expect(mocks.init).not.toHaveBeenCalled();
    expect(isCrashReportingEnabled()).toBe(false);
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
    const { initCrashReporting, applyCrashReportsSetting, isCrashReportingEnabled } =
      await load();
    initCrashReporting();
    applyCrashReportsSetting(true);
    expect(mocks.close).not.toHaveBeenCalled();

    applyCrashReportsSetting(false);
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(isCrashReportingEnabled()).toBe(false);
    applyCrashReportsSetting(false);
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});

describe('renderer crash consent', () => {
  it('sends the dump only after the user agrees, once the UI is ready', async () => {
    const { initCrashReporting, markCrashUiReady } = await load();
    initCrashReporting();
    mocks.showMessageBox.mockResolvedValue({ response: 0 });

    const sent = beforeSend()(rendererCrash);
    await vi.waitFor(() => expect(mocks.showMessageBox).not.toHaveBeenCalled());
    markCrashUiReady();
    expect(await sent).not.toBeNull();
    expect(mocks.showMessageBox).toHaveBeenCalledOnce();
  });

  it('does not send when the user declines', async () => {
    const { initCrashReporting, markCrashUiReady } = await load();
    initCrashReporting();
    markCrashUiReady();
    expect(await beforeSend()(rendererCrash)).toBeNull();
  });

  it('does not send when the prompt itself fails', async () => {
    const { initCrashReporting, markCrashUiReady } = await load();
    initCrashReporting();
    markCrashUiReady();
    mocks.showMessageBox.mockRejectedValue(new Error('no window'));
    expect(await beforeSend()(rendererCrash)).toBeNull();
  });

  it('asks one crash at a time', async () => {
    const { initCrashReporting, markCrashUiReady } = await load();
    initCrashReporting();
    markCrashUiReady();
    let release: (value: { response: number }) => void = () => undefined;
    mocks.showMessageBox.mockReturnValueOnce(
      new Promise((resolve) => (release = resolve)),
    );
    mocks.showMessageBox.mockResolvedValue({ response: 1 });

    const first = beforeSend()(rendererCrash);
    const second = beforeSend()(rendererCrash);
    await vi.waitFor(() => expect(mocks.showMessageBox).toHaveBeenCalledOnce());
    release({ response: 0 });
    expect(await first).not.toBeNull();
    expect(await second).toBeNull();
    expect(mocks.showMessageBox).toHaveBeenCalledTimes(2);
  });
});
