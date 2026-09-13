/** Binds `interface Settings` (fiddle.eipc) for one window. */
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  app,
  dialog,
  nativeTheme,
  shell,
  type OpenDialogOptions,
  type SaveDialogOptions,
  type WebContents,
} from 'electron';

import { implement, Settings } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import type { ThemeFile } from '../../shared/settings';
import { tm } from '../i18n';
import { log } from '../log';
import { builtinThemeFile, themeFromMonaco, themeId, writeTheme } from '../themes/themes';
import { getWindow } from '../windows';
import { settingsContext } from './index';
import { sanitizeSettings, SETTINGS_VERSION } from './service';

const t = tm('mainSettings');

async function openPath(target: string): Promise<void> {
  const reason = await shell.openPath(target);
  if (reason) throw new FiddleError(ErrorCode.unavailable, t('openFailed', { path: target, reason }));
}

async function pickJsonFile(windowId: string, title: string): Promise<string | undefined> {
  const options: OpenDialogOptions = {
    title,
    properties: ['openFile'],
    filters: [{ name: t('jsonFiles'), extensions: ['json'] }],
  };
  const win = getWindow(windowId);
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  return result.canceled ? undefined : result.filePaths[0];
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

/** Writes a new theme file, selects it and returns the App rev. */
async function addTheme(theme: ThemeFile, reveal: boolean): Promise<number> {
  const ctx = settingsContext();
  const onDisk = await fsp.readdir(ctx.themesDir).catch(() => [] as string[]);
  const taken = new Set(onDisk.map((name) => name.replace(/\.json$/, '')));
  const id = themeId(theme.name, taken);
  const file = await writeTheme(ctx.themesDir, id, theme);
  await ctx.refreshThemes();
  const rev = ctx.service.set('theme', id);
  if (reveal) shell.showItemInFolder(file);
  return rev;
}

export function bindSettingsIpc(contents: WebContents, windowId: string): void {
  implement(Settings, contents, {
    SetSetting: (key, value) => settingsContext().service.set(key, value),
    ResetSetting: (key) => settingsContext().service.reset(key),

    OpenSettingsFile: async () => {
      const { store } = settingsContext();
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
      const { settings, dropped } = sanitizeSettings(data);
      if (dropped.length > 0) log.warn('settings import dropped keys', dropped);
      return settingsContext().service.replace(settings);
    },

    ExportSettings: async () => {
      const options: SaveDialogOptions = {
        title: t('exportSettingsTitle'),
        defaultPath: path.join(app.getPath('documents'), 'fiddle-settings.json'),
        filters: [{ name: t('jsonFiles'), extensions: ['json'] }],
      };
      const win = getWindow(windowId);
      const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return;
      const data = settingsContext().service.exportData();
      await fsp.writeFile(result.filePath, `${JSON.stringify(data, null, 2)}\n`);
    },

    DismissStorageNotice: (id) => settingsContext().service.dismissStorageNotice(id),

    GetTheme: (id) => settingsContext().themes.find((theme) => theme.id === id) ?? null,
    RefreshThemes: () => settingsContext().refreshThemes(),

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
      return addTheme(theme, false);
    },

    CreateTheme: async () => {
      const ctx = settingsContext();
      const current = ctx.themes.find((theme) => theme.id === ctx.service.settings.theme);
      const isDark = nativeTheme.shouldUseDarkColors;
      const base: ThemeFile = current
        ? { name: current.name, isDark: current.isDark, editor: current.editor, common: current.common }
        : builtinThemeFile(t(isDark ? 'lucentDark' : 'lucentLight'), isDark);
      return addTheme({ ...base, name: t('themeCopyName', { name: base.name }) }, true);
    },

    OpenThemesFolder: async () => {
      const { themesDir } = settingsContext();
      await fsp.mkdir(themesDir, { recursive: true });
      await openPath(themesDir);
    },
  });
}
