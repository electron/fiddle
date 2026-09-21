/** Settings startup: the App fields read from settings.json, the OS theme, screen reader, contrast and locale wiring, and live reloads of outside edits. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILTIN_THEME, defaultSettings, type Settings } from '../../shared/settings';
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
vi.mock('../i18n', () => ({ setMainLocale: mocks.setMainLocale }));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { app, nativeTheme } = await import('electron');
const { flushAll, onJsonStoreNotice } = await import('../persistence/json-store');
const { SETTINGS_VERSION } = await import('./service');
const { loadSettings, preferredLocales, startSettings } = await import('./index');

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
  // The settings watcher may still hold the folder for a moment on Windows.
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
});

function writeSettings(sparse: Partial<Settings>, version = SETTINGS_VERSION): void {
  fs.writeFileSync(
    path.join(dir, 'settings.json'),
    JSON.stringify({ schemaVersion: version, ...sparse }),
  );
}

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

  it('turns a settings file from a newer app version into a storage notice', async () => {
    writeSettings({ packageManager: 'yarn' }, SETTINGS_VERSION + 1);
    const { store, initialApp } = loadSettings(dir);
    const hub = fakeHub(initialApp);
    await startSettings(hub as never, store, dir);
    expect(hub.app.storageNotices).toEqual([
      { id: expect.any(String), kind: 'newer-version', file: 'settings.json' },
    ]);
    expect(store.readOnly).toBe(true);
  });

  it('applies an outside edit to settings.json shortly after it is saved', async () => {
    vi.useFakeTimers();
    const { hub } = await start({ packageManager: 'npm' });
    const applied = () => hub.app.settings.packageManager === 'yarn';
    // The OS delivers the change between checks, and each check first advances
    // the debounce. macOS can start reporting a moment after the watch begins,
    // so the edit is saved again until it is seen.
    await vi.waitFor(
      () => {
        if (applied()) return;
        writeSettings({ packageManager: 'yarn', showObsolete: true });
        throw new Error('not applied yet');
      },
      { timeout: 4000, interval: 250 },
    );
    expect(hub.app.settings).toMatchObject({
      packageManager: 'yarn',
      showObsolete: true,
    });
  });
});
