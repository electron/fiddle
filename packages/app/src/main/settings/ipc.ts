/** Binds `interface Settings` (fiddle.eipc) for one window. */
import fsp from 'node:fs/promises';
import path from 'node:path';

import { app, nativeTheme, shell } from 'electron';

import { implement, Settings } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { changedExecutionSettings, type Settings as AppSettings, type ThemeFile } from '../../shared/settings';
import { confirm, pickFile, pickSave } from '../dialogs';
import { dialogText } from '../documents/deep-link-queue';
import { tm } from '../i18n';
import type { IpcContext } from '../ipc';
import { log } from '../log';
import { builtinThemeFile, themeFromMonaco, themeId, writeTheme } from '../themes/themes';
import type { SettingsContext } from './index';
import { sanitizeSettings, SETTINGS_VERSION } from './service';

const t = tm('mainSettings');

async function openPath(target: string): Promise<void> {
  const reason = await shell.openPath(target);
  if (reason) throw new FiddleError(ErrorCode.unavailable, t('openFailed', { path: target, reason }));
}

function pickJsonFile(windowId: string, title: string): Promise<string | undefined> {
  return pickFile(windowId, { title, filters: [{ name: t('jsonFiles'), extensions: ['json'] }] });
}

async function readJson(file: string): Promise<unknown> {
  const text = await fsp.readFile(file, 'utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FiddleError(ErrorCode.invalidArgument, t('notJson', { file: path.basename(file) }));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Asks before an import changes flags, environment variables or mirrors, listing each with its new value. */
function confirmExecutionSettings(
  windowId: string,
  keys: readonly (keyof AppSettings)[],
  next: AppSettings,
): Promise<boolean> {
  const lines = keys.map((key) => {
    const value = next[key];
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    return `${key}: ${dialogText(text) || t('importEmpty')}`;
  });
  return confirm(windowId, {
    type: 'warning',
    message: t('importExecutionMessage'),
    detail: [t('importExecutionDetail'), '', ...lines].join('\n'),
    ok: t('importButton'),
    defaultId: 1,
  });
}

/** Writes a new theme file, selects it and returns the App rev. */
async function addTheme(settings: SettingsContext, theme: ThemeFile, reveal: boolean): Promise<number> {
  const onDisk = await fsp.readdir(settings.themesDir).catch(() => [] as string[]);
  const taken = new Set(onDisk.map((name) => name.replace(/\.json$/, '')));
  const id = themeId(theme.name, taken);
  const file = await writeTheme(settings.themesDir, id, theme);
  await settings.refreshThemes();
  const rev = settings.service.set('theme', id);
  if (reveal) shell.showItemInFolder(file);
  return rev;
}

export function bindSettingsIpc({ contents, windowId, services: { settings } }: IpcContext): void {
  const { service, store } = settings;
  implement(Settings, contents, {
    SetSetting: (key, value) => service.set(key, value),
    ResetSetting: (key) => service.reset(key),

    OpenSettingsFile: async () => {
      await store.flush();
      await fsp.mkdir(path.dirname(store.file), { recursive: true });
      await fsp
        .writeFile(store.file, `${JSON.stringify({ schemaVersion: SETTINGS_VERSION }, null, 2)}\n`, {
          flag: 'wx',
        })
        .catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'EEXIST') throw error;
        });
      await openPath(store.file);
    },

    ImportSettings: async () => {
      const file = await pickJsonFile(windowId, t('importSettingsTitle'));
      if (!file) return null;
      const data = await readJson(file);
      if (!isRecord(data)) {
        throw new FiddleError(ErrorCode.invalidArgument, t('notSettings', { file: path.basename(file) }));
      }
      const { settings: imported, dropped } = sanitizeSettings(data);
      if (dropped.length > 0) log.warn('settings import dropped keys', dropped);
      // Flags, variables and mirrors decide what runs, so the user sees them first (§4).
      const changed = changedExecutionSettings(service.settings, imported);
      if (changed.length > 0 && !(await confirmExecutionSettings(windowId, changed, imported))) return null;
      return service.replace(imported);
    },

    ExportSettings: async () => {
      const file = await pickSave(windowId, {
        title: t('exportSettingsTitle'),
        defaultPath: path.join(app.getPath('documents'), 'fiddle-settings.json'),
        filters: [{ name: t('jsonFiles'), extensions: ['json'] }],
      });
      if (!file) return;
      await fsp.writeFile(file, `${JSON.stringify(service.exportData(), null, 2)}\n`);
    },

    DismissStorageNotice: (id) => service.dismissStorageNotice(id),

    GetTheme: (id) => settings.themes.find((theme) => theme.id === id) ?? null,
    RefreshThemes: () => settings.refreshThemes(),

    ImportTheme: async () => {
      const file = await pickJsonFile(windowId, t('importThemeTitle'));
      if (!file) return null;
      const name = path.basename(file, path.extname(file));
      let theme: ThemeFile;
      try {
        theme = themeFromMonaco(name, await readJson(file));
      } catch (error) {
        log.warn('theme import rejected', error);
        throw new FiddleError(ErrorCode.invalidArgument, t('notTheme', { file: path.basename(file) }));
      }
      return addTheme(settings, theme, false);
    },

    CreateTheme: async () => {
      const current = settings.themes.find((theme) => theme.id === service.settings.theme);
      const isDark = nativeTheme.shouldUseDarkColors;
      const base: ThemeFile = current
        ? { name: current.name, isDark: current.isDark, editor: current.editor, common: current.common }
        : builtinThemeFile(t(isDark ? 'lucentDark' : 'lucentLight'), isDark);
      return addTheme(settings, { ...base, name: t('themeCopyName', { name: base.name }) }, true);
    },

    OpenThemesFolder: async () => {
      await fsp.mkdir(settings.themesDir, { recursive: true });
      await openPath(settings.themesDir);
    },
  });
}
