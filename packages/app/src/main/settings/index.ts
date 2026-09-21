import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { app, nativeTheme } from 'electron';

import { ErrorCode, FiddleError } from '../../shared/errors';
import {
  defaultSettings,
  fromSparse,
  isSettingKey,
  localePreference,
  parseSetting,
  resolveScreenReader,
  SETTINGS_VERSION,
  settingsSchema,
  toSparse,
  unknownKeys,
  type SettingKey,
  type Settings,
  type SparseSettings,
  type ThemeData,
} from '../../shared/settings';
import type { AppState } from '../../shared/stores';
import { setMainLocale, tm } from '../i18n';
import { log } from '../log';
import {
  createJsonStore,
  onJsonStoreNotice,
  type JsonStore,
} from '../persistence/json-store';
import type { StateHub } from '../state-hub';
import { loadThemes, summarize, themeSource } from '../themes/themes';

export interface SettingsContext {
  store: JsonStore<SparseSettings>;
  themesDir: string;
  /** Custom themes with their data, as last scanned. */
  themes: ThemeData[];
  /** Rescans the themes folder and returns the App rev. */
  refreshThemes(): Promise<number>;
  /** These validate, apply to the App store, keep settings.json sparse and return the App rev. */
  set(key: string, value: unknown): number;
  reset(key: string): number;
  replace(settings: Settings): number;
  /** The sparse settings, as export writes them. */
  exportData(): Record<string, unknown>;
  dismissStorageNotice(id: string): number;
}

type SettingsAppFields = Pick<
  AppState,
  'settings' | 'themes' | 'screenReaderActive' | 'storageNotices' | 'highContrast'
>;

export function loadSettings(userData = app.getPath('userData')): {
  store: JsonStore<SparseSettings>;
  initialApp: SettingsAppFields;
} {
  const store = createJsonStore<SparseSettings>({
    file: path.join(userData, 'settings.json'),
    schema: settingsSchema,
    defaults: {},
    version: SETTINGS_VERSION,
  });
  const settings = fromSparse(store.get());
  return {
    store,
    initialApp: {
      settings,
      themes: [],
      screenReaderActive: resolveScreenReader(
        settings.screenReader,
        app.isAccessibilitySupportEnabled(),
      ),
      storageNotices: [],
      highContrast: nativeTheme.shouldUseHighContrastColors,
    },
  };
}

/** The locale list main's i18n should start with, honouring the setting. */
export function preferredLocales(store: JsonStore<SparseSettings>): string[] {
  return localePreference(
    fromSparse(store.get()).locale,
    app.getPreferredSystemLanguages(),
  );
}

function knownKey(key: string): SettingKey {
  if (isSettingKey(key)) return key;
  throw new FiddleError(
    ErrorCode.invalidArgument,
    tm('mainSettings')('unknownSetting', { key }),
  );
}

export async function startSettings(
  hub: StateHub,
  store: JsonStore<SparseSettings>,
  userData = app.getPath('userData'),
): Promise<SettingsContext> {
  const themesDir = path.join(userData, 'themes');
  const ctx: SettingsContext = {
    store,
    themesDir,
    themes: [],
    async refreshThemes() {
      ctx.themes = await loadThemes(themesDir, hub.app.locale);
      return hub.updateApp({ themes: ctx.themes.map(summarize) });
    },
    set(name, value) {
      const key = knownKey(name);
      const parsed = parseSetting(key, value);
      if (!parsed) {
        throw new FiddleError(
          ErrorCode.invalidArgument,
          tm('mainSettings')('invalidValue', { setting: tm('settings')(`${key}.title`) }),
          { key },
        );
      }
      return ctx.replace({ ...hub.app.settings, [key]: parsed.value });
    },
    reset: (name) => ctx.set(name, defaultSettings[knownKey(name)]),
    replace(settings) {
      store.set((prev) => ({ ...unknownKeys(prev), ...toSparse(settings) }));
      return hub.updateApp({ settings });
    },
    exportData: () => ({
      schemaVersion: SETTINGS_VERSION,
      ...toSparse(hub.app.settings),
    }),
    dismissStorageNotice: (id) =>
      hub.updateApp({
        storageNotices: hub.app.storageNotices.filter((notice) => notice.id !== id),
      }),
  };

  // Corrupt or too-new files (from any store) become toasts.
  onJsonStoreNotice((notice) =>
    hub.updateApp({
      storageNotices: [
        ...hub.app.storageNotices,
        { id: randomUUID(), kind: notice.kind, file: path.basename(notice.file) },
      ],
    }),
  );
  await ctx.refreshThemes();

  let appliedLocale = hub.app.settings.locale;
  const apply = () => {
    const { settings } = hub.app;
    const source = themeSource(settings, hub.app.themes);
    if (nativeTheme.themeSource !== source) nativeTheme.themeSource = source;

    const screenReaderActive = resolveScreenReader(
      settings.screenReader,
      app.isAccessibilitySupportEnabled(),
    );
    if (screenReaderActive !== hub.app.screenReaderActive)
      hub.updateApp({ screenReaderActive });

    // OS high contrast shows Lucent's high-contrast variant.
    const highContrast = nativeTheme.shouldUseHighContrastColors;
    if (highContrast !== hub.app.highContrast) hub.updateApp({ highContrast });

    if (settings.locale !== appliedLocale) {
      appliedLocale = settings.locale;
      setMainLocale(localePreference(settings.locale, app.getPreferredSystemLanguages()))
        .then((locale) => {
          if (locale !== hub.app.locale) hub.updateApp({ locale });
        })
        .catch((error: unknown) => log.error('failed to switch locale', error));
    }
  };
  hub.onChange((change) => {
    if (change.store === 'app') apply();
  });
  app.on('accessibility-support-changed', apply);
  nativeTheme.on('updated', apply);
  apply();

  watchSettingsFile(store, hub);
  return ctx;
}

/** Applies outside edits to settings.json (from "Open settings.json") live, without writing it back. */
function watchSettingsFile(store: JsonStore<SparseSettings>, hub: StateHub): void {
  const name = path.basename(store.file);
  let timer: NodeJS.Timeout | undefined;
  try {
    fs.mkdirSync(path.dirname(store.file), { recursive: true });
    const watcher = fs.watch(path.dirname(store.file), (_event, changed) => {
      if (changed !== name) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (store.reload()) hub.updateApp({ settings: fromSparse(store.get()) });
      }, 200);
    });
    watcher.on('error', (error) => log.warn('settings watcher failed', error));
    watcher.unref();
  } catch (error) {
    log.warn('cannot watch settings.json', error);
  }
}
