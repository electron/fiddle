/** Settings: the App fields read from settings.json, changing and replacing settings, the OS theme, screen reader, contrast and locale wiring, and live reloads of outside edits. */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FiddleError } from '../../shared/errors';
import {
  BUILTIN_THEME,
  defaultSettings,
  fromSparse,
  sanitizeSettings,
  SETTINGS_VERSION,
  type Settings,
} from '../../shared/settings';
import type { AppState } from '../../shared/stores';

const mocks = vi.hoisted(() => ({
  accessibility: false,
  highContrast: false,
  systemLanguages: ['fr-FR', 'en'],
  setMainLocale: vi.fn(async (locales: string[]) => locales[0] ?? 'en'),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    app: Object.assign(new EventEmitter(), {
      isAccessibilitySupportEnabled: () => mocks.accessibility,
      getPreferredSystemLanguages: () => mocks.systemLanguages,
    }),
    nativeTheme: Object.defineProperty(
      Object.assign(new EventEmitter(), { themeSource: 'system' }),
      'shouldUseHighContrastColors',
      { get: () => mocks.highContrast },
    ),
  };
});
vi.mock('../i18n', () => ({
  setMainLocale: mocks.setMainLocale,
  tm: () => (key: string) => key,
}));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { app, nativeTheme } = await import('electron');
const { flushAll, onJsonStoreNotice } = await import('../persistence/json-store');
const { loadSettings, preferredLocales, startSettings } = await import('./index');

// The folder watcher is faked: the test reports changes itself, which keeps OS
// latency out of it (and a real watch on a short-lived temp folder crashed Node on Windows CI).
type WatchListener = (event: 'rename' | 'change', filename: string | null) => void;
let reportChange: WatchListener = () => undefined;
vi.spyOn(fs, 'watch').mockImplementation(((_dir: unknown, listener: WatchListener) => {
  reportChange = listener;
  return Object.assign(new EventEmitter(), { close: vi.fn(), unref: vi.fn() });
}) as never);

let dir = '';
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-settings-'));
  mocks.accessibility = false;
  mocks.setMainLocale.mockClear();
  mocks.highContrast = false;
  nativeTheme.themeSource = 'system';
  // As at startup: no listener yet, so notices queue until `startSettings`.
  onJsonStoreNotice(undefined);
});
afterEach(async () => {
  vi.useRealTimers();
  await flushAll();
  // Drop the listeners each `startSettings` added, so they don't fire for the next test.
  app.removeAllListeners();
  nativeTheme.removeAllListeners();
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeSettings(sparse: Partial<Settings>, version = SETTINGS_VERSION): void {
  fs.writeFileSync(
    path.join(dir, 'settings.json'),
    JSON.stringify({ schemaVersion: version, ...sparse }),
  );
}

const readJson = () =>
  JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')) as unknown;

function writeTheme(id: string, theme: { name: string; isDark: boolean }): void {
  fs.mkdirSync(path.join(dir, 'themes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'themes', `${id}.json`), JSON.stringify(theme));
}

/** The StateHub as settings use it: the App store, with change listeners. */
function fakeHub(initial: Partial<AppState>) {
  const listeners = new Set<(change: { store: 'app' }) => void>();
  const hub = {
    app: { rev: 0, locale: 'fr-FR', ...initial } as AppState,
    updateApp(patch: Partial<AppState>) {
      hub.app = { ...hub.app, ...patch, rev: hub.app.rev + 1 };
      for (const listener of listeners) listener({ store: 'app' });
      return hub.app.rev;
    },
    onChange(listener: (change: { store: 'app' }) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setSettings(patch: Partial<Settings>) {
      hub.updateApp({ settings: { ...hub.app.settings, ...patch } });
    },
  };
  return hub;
}

async function start(sparse: Partial<Settings> = {}) {
  writeSettings(sparse);
  const { store, initialApp } = loadSettings(dir);
  const hub = fakeHub(initialApp);
  const ctx = await startSettings(hub as never, store, dir);
  return { hub, store, ctx };
}

describe('loadSettings', () => {
  it('starts the App store from settings.json, the OS screen reader and high contrast', () => {
    writeSettings({ packageManager: 'yarn' });
    mocks.accessibility = true;
    mocks.highContrast = true;
    const { initialApp } = loadSettings(dir);
    expect(initialApp).toEqual({
      settings: { ...defaultSettings, packageManager: 'yarn' },
      themes: [],
      screenReaderActive: true,
      storageNotices: [],
      highContrast: true,
    });
  });

  it('lets the screen reader setting override the OS', () => {
    writeSettings({ screenReader: 'off' });
    mocks.accessibility = true;
    expect(loadSettings(dir).initialApp.screenReaderActive).toBe(false);
  });

  it('puts a chosen locale ahead of the system languages', () => {
    writeSettings({});
    expect(preferredLocales(loadSettings(dir).store)).toEqual(['fr-FR', 'en']);
    writeSettings({ locale: 'de' });
    expect(preferredLocales(loadSettings(dir).store)).toEqual(['de', 'fr-FR', 'en']);
  });
});

describe('startSettings', () => {
  it('applies a change and returns the rev that includes it, keeping settings.json sparse', async () => {
    const { hub, store, ctx } = await start();
    const rev = hub.app.rev;
    expect(ctx.set('packageManager', 'yarn')).toBe(rev + 1);
    expect(hub.app.rev).toBe(rev + 1);
    expect(hub.app.settings.packageManager).toBe('yarn');
    ctx.set('showObsolete', true);
    await store.flush();
    expect(readJson()).toEqual({
      schemaVersion: 1,
      packageManager: 'yarn',
      showObsolete: true,
    });

    ctx.set('showObsolete', false);
    ctx.reset('packageManager');
    await store.flush();
    expect(readJson()).toEqual({ schemaVersion: 1 });
  });

  it('rejects invalid values and unknown keys without changing anything', async () => {
    const { hub, ctx } = await start();
    const rev = hub.app.rev;
    expect(() => ctx.set('packageManager', 'pnpm')).toThrow(FiddleError);
    expect(() => ctx.set('nope', true)).toThrow('unknownSetting');
    expect(() => ctx.reset('nope')).toThrow('unknownSetting');
    expect(hub.app.rev).toBe(rev);
  });

  it('keeps keys from newer app versions in the file', async () => {
    const { store, ctx } = await start({
      futureSetting: 42,
      showObsolete: true,
    } as never);
    ctx.set('packageManager', 'yarn');
    await store.flush();
    expect(readJson()).toEqual({
      schemaVersion: 1,
      futureSetting: 42,
      showObsolete: true,
      packageManager: 'yarn',
    });
  });

  it('validates an outside settings object per key, and replaces and exports the sparse values', async () => {
    const { hub, ctx } = await start();
    ctx.set('showObsolete', true);
    const { settings, dropped } = sanitizeSettings({
      schemaVersion: 1,
      packageManager: 'yarn',
      theme: 42,
      unknown: 'x',
    });
    expect(settings).toEqual({ packageManager: 'yarn' });
    expect(dropped).toEqual(['theme', 'unknown']);
    ctx.replace(fromSparse(settings));
    expect(hub.app.settings.showObsolete).toBe(false);
    expect(hub.app.settings.packageManager).toBe('yarn');
    expect(ctx.exportData()).toEqual({ schemaVersion: 1, packageManager: 'yarn' });
  });

  it('publishes the custom themes and sets the OS appearance from the chosen one', async () => {
    writeTheme('midnight', { name: 'Midnight', isDark: true });
    const { hub, ctx } = await start({ theme: 'midnight', appearance: 'light' });
    expect(hub.app.themes).toEqual([{ id: 'midnight', name: 'Midnight', isDark: true }]);
    expect(ctx.themes[0]).toMatchObject({ id: 'midnight' });
    expect(nativeTheme.themeSource).toBe('dark');

    hub.setSettings({ theme: BUILTIN_THEME });
    expect(nativeTheme.themeSource).toBe('light');

    fs.rmSync(path.join(dir, 'themes'), { recursive: true });
    await ctx.refreshThemes();
    expect(hub.app.themes).toEqual([]);
  });

  it('follows the OS screen reader and high contrast as they change', async () => {
    const { hub } = await start();
    expect(hub.app).toMatchObject({ screenReaderActive: false, highContrast: false });

    mocks.accessibility = true;
    app.emit('accessibility-support-changed');
    expect(hub.app.screenReaderActive).toBe(true);

    mocks.highContrast = true;
    nativeTheme.emit('updated');
    expect(hub.app.highContrast).toBe(true);
  });

  it("switches main's locale when the setting changes, and publishes the one it got", async () => {
    const { hub } = await start();
    expect(mocks.setMainLocale).not.toHaveBeenCalled();

    mocks.setMainLocale.mockResolvedValueOnce('de');
    hub.setSettings({ locale: 'de-CH' });
    expect(mocks.setMainLocale).toHaveBeenCalledWith(['de-CH', 'fr-FR', 'en']);
    await vi.waitFor(() => expect(hub.app.locale).toBe('de'));

    hub.setSettings({ packageManager: 'yarn' });
    expect(mocks.setMainLocale).toHaveBeenCalledOnce();
  });

  it('turns a settings file from a newer app version into a storage notice, until dismissed', async () => {
    writeSettings({ packageManager: 'yarn' }, SETTINGS_VERSION + 1);
    const { store, initialApp } = loadSettings(dir);
    const hub = fakeHub(initialApp);
    const ctx = await startSettings(hub as never, store, dir);
    expect(hub.app.storageNotices).toEqual([
      { id: expect.any(String), kind: 'newer-version', file: 'settings.json' },
    ]);
    expect(store.readOnly).toBe(true);
    ctx.dismissStorageNotice(hub.app.storageNotices[0]!.id);
    expect(hub.app.storageNotices).toEqual([]);
  });

  it('applies an outside edit to settings.json once the writes settle, and ignores other files', async () => {
    vi.useFakeTimers();
    const { hub } = await start({ packageManager: 'npm' });
    writeSettings({ packageManager: 'yarn', showObsolete: true });
    reportChange('change', 'window-state.json');
    vi.advanceTimersByTime(200);
    expect(hub.app.settings.packageManager).toBe('npm');

    reportChange('rename', 'settings.json');
    reportChange('change', 'settings.json');
    vi.advanceTimersByTime(199);
    expect(hub.app.settings.packageManager).toBe('npm');
    vi.advanceTimersByTime(1);
    expect(hub.app.settings).toMatchObject({
      packageManager: 'yarn',
      showObsolete: true,
    });
  });
});
