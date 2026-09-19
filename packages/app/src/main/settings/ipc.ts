import { existsSync } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { app, shell } from 'electron';

import { implement, Settings } from '../../ipc/main';
import { ErrorCode, FiddleError } from '../../shared/errors';
import {
  changedExecutionSettings,
  fromSparse,
  type Settings as AppSettings,
  type ThemeFile,
  type ThemeSnapshot,
} from '../../shared/settings';
import { confirm, pickFile, pickSave } from '../dialogs';
import { dialogText } from '../documents/deep-link-queue';
import { tm } from '../i18n';
import type { IpcContext } from '../ipc';
import { log } from '../log';
import { writeAtomic } from '../persistence/json-store';
import { themeFromMonaco, themeId, writeTheme } from '../themes/themes';
import type { SettingsContext } from './index';
import { sanitizeSettings, SETTINGS_VERSION } from './service';

const t = tm('mainSettings');

async function openPath(target: string): Promise<void> {
  const reason = await shell.openPath(target);
  if (reason)
    throw new FiddleError(
      ErrorCode.unavailable,
      t('openFailed', { path: target, reason }),
    );
}

function pickJsonFile(windowId: string, title: string): Promise<string | undefined> {
  return pickFile(windowId, {
    title,
    filters: [{ name: t('jsonFiles'), extensions: ['json'] }],
  });
}

async function readJson(file: string): Promise<unknown> {
  const text = await fsp.readFile(file, 'utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FiddleError(
      ErrorCode.invalidArgument,
      t('notJson', { file: path.basename(file) }),
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Asks before an import changes flags, environment variables or mirrors, listing each with its new value. */
function confirmExecutionSettings(
  windowId: string,
  keys: ReturnType<typeof changedExecutionSettings>,
  next: AppSettings,
): Promise<boolean> {
  const ts = tm('settings');
  const lines = keys.map((key) => {
    const value = next[key];
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    return t('importSettingLine', {
      setting: ts(`${key}.title`),
      value: dialogText(text) || t('importEmpty'),
    });
  });
  return confirm(windowId, {
    type: 'warning',
    message: t('importExecutionMessage'),
    detail: [t('importExecutionDetail'), '', ...lines].join('\n'),
    ok: t('importButton'),
    defaultId: 1,
  });
}

function builtinThemeName({ isDark, editor }: ThemeSnapshot) {
  if (editor.base === 'hc-black' || editor.base === 'hc-light')
    return isDark ? 'lucentHcDark' : 'lucentHcLight';
  return isDark ? 'lucentDark' : 'lucentLight';
}

/** Writes a new theme file, selects it and returns the App rev. */
async function addTheme(
  settings: SettingsContext,
  theme: ThemeFile,
  reveal: boolean,
): Promise<number> {
  const onDisk = await fsp.readdir(settings.themesDir).catch(() => [] as string[]);
  const taken = new Set(onDisk.map((name) => name.replace(/\.json$/, '')));
  const id = themeId(theme.name, taken);
  const file = await writeTheme(settings.themesDir, id, theme);
  await settings.refreshThemes();
  const rev = settings.service.set('theme', id);
  if (reveal) shell.showItemInFolder(file);
  return rev;
}

export function bindSettingsIpc({
  contents,
  windowId,
  services: { settings },
}: IpcContext): void {
  const { service, store } = settings;
  implement(Settings, contents, {
    SetSetting: (key, value) => service.set(key, value),
    ResetSetting: (key) => service.reset(key),

    OpenSettingsFile: async () => {
      await store.flush();
      if (!existsSync(store.file)) {
        await writeAtomic(
          store.file,
          `${JSON.stringify({ schemaVersion: SETTINGS_VERSION }, null, 2)}\n`,
        );
      }
      await openPath(store.file);
    },

    ImportSettings: async () => {
      const file = await pickJsonFile(windowId, t('importSettingsTitle'));
      if (!file) return null;
      const data = await readJson(file);
      if (!isRecord(data)) {
        throw new FiddleError(
          ErrorCode.invalidArgument,
          t('notSettings', { file: path.basename(file) }),
        );
      }
      const { settings: imported, dropped } = sanitizeSettings(data);
      if (dropped.length > 0) log.warn('settings import dropped keys', dropped);
      // Export is sparse: a key the file lacks is at its default, except `crashReports`, which must not turn back on unasked.
      const next = {
        ...fromSparse(imported),
        crashReports: imported.crashReports ?? service.settings.crashReports,
      };
      // Flags, variables and mirrors decide what runs, so the user sees them first.
      const changed = changedExecutionSettings(service.settings, next);
      if (
        changed.length > 0 &&
        !(await confirmExecutionSettings(windowId, changed, next))
      )
        return null;
      return service.replace(next);
    },

    ExportSettings: async () => {
      const file = await pickSave(windowId, {
        title: t('exportSettingsTitle'),
        defaultPath: path.join(app.getPath('documents'), 'fiddle-settings.json'),
        filters: [{ name: t('jsonFiles'), extensions: ['json'] }],
      });
      if (!file) return;
      await writeAtomic(file, `${JSON.stringify(service.exportData(), null, 2)}\n`);
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
        throw new FiddleError(
          ErrorCode.invalidArgument,
          t('notTheme', { file: path.basename(file) }),
        );
      }
      return addTheme(settings, theme, false);
    },

    CreateTheme: async (builtin) => {
      const current = settings.themes.find(
        (theme) => theme.id === service.settings.theme,
      );
      let base: ThemeFile;
      if (current) {
        base = {
          name: current.name,
          isDark: current.isDark,
          editor: current.editor,
          common: current.common,
        };
      } else if (builtin) {
        // A built-in theme as the window renders it: Lucent's Monaco theme and token values.
        base = { name: t(builtinThemeName(builtin)), ...builtin };
      } else {
        throw new FiddleError(ErrorCode.invalidArgument, t('themeNeedsValues'));
      }
      return addTheme(
        settings,
        { ...base, name: t('themeCopyName', { name: base.name }) },
        true,
      );
    },

    OpenThemesFolder: async () => {
      await fsp.mkdir(settings.themesDir, { recursive: true });
      await openPath(settings.themesDir);
    },
  });
}
