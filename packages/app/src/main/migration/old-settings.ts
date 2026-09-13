/**
 * Maps the previous Electron Fiddle's localStorage (every `GlobalSetting` in
 * its src/interfaces.ts, plus the window setting `gitHubPublishAsPublic`) to
 * the new sparse settings (REQUIREMENTS §6). Pure.
 *
 * The old app stored strings as they are (`theme`, `packageManager`,
 * `fontFamily`, …), booleans and numbers with `toString()`, and arrays and
 * objects as JSON. Values that fail the new schema are dropped, and values
 * equal to the new defaults are left out, so the result is sparse.
 */
import {
  defaultSettings,
  parseSetting,
  sameValue,
  type SettingKey,
  type Settings,
  type SparseSettings,
} from '../../shared/settings';

export interface OldLocalVersion {
  version: string;
  localPath: string;
  name?: string;
}

interface MappedOldSettings {
  settings: SparseSettings;
  /** The old `hasShownTour`: the onboarding tour was already seen. */
  tourDone: boolean;
  gitHubLogin?: string;
  /** Local builds from the old `local-electron-versions` key (older app versions). */
  localVersions: OldLocalVersion[];
  /** Known old keys the new app has no use for. */
  ignored: string[];
  /** Keys the old app never wrote. Logged and ignored. */
  unknown: string[];
  /** Known keys whose value didn't fit the new schema. */
  invalid: string[];
}

interface MapOldSettingsOptions {
  /** Imported custom themes: old file name without `.json` → new theme ID. */
  themeIds: ReadonlyMap<string, string>;
  /** The OS user name. An old author equal to it stays unset, which means the same thing. */
  osUser: string;
}

/** Old keys that are read below. */
const MAPPED_KEYS = new Set([
  'acceleratorsToBlock',
  'channelsToShow',
  'electronMirror',
  'environmentVariables',
  'executionFlags',
  'fontFamily',
  'fontSize',
  'gitHubLogin',
  'gitHubPublishAsPublic',
  'hasShownTour',
  'isClearingConsoleOnRun',
  'isEnablingElectronLogging',
  'isKeepingUserDataDirs',
  'isPublishingGistAsRevision',
  'isShowingGistHistory',
  'isUsingSocketFirewall',
  'isUsingSystemTheme',
  'local-electron-versions',
  'packageAuthor',
  'packageManager',
  'showObsoleteVersions',
  'showUndownloadedVersions',
  'theme',
]);

/**
 * Old keys the new app doesn't use: the plaintext token of very old versions
 * (the token is imported from `.github-credentials` instead), the cached
 * release list and the last selected version.
 */
const IGNORED_KEYS = new Set(['gitHubToken', 'known-electron-versions', 'version']);

/** Old `BlockableAccelerator` values → the commands they blocked. */
const BLOCKABLE: Record<string, string> = { save: 'file.save', saveAs: 'file.saveAs' };

const BUILTIN_DARK = 'defaultDark';
const BUILTIN_LIGHT = 'defaultLight';

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseBool(raw: string | undefined): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

/** Old theme file name, with or without `.json`. */
export function oldThemeKey(name: string): string {
  return name.replace(/\.json$/i, '');
}

export function mapOldSettings(
  values: Readonly<Record<string, string>>,
  { themeIds, osUser }: MapOldSettingsOptions,
): MappedOldSettings {
  const settings: Partial<Record<SettingKey, unknown>> = {};
  const result: MappedOldSettings = {
    settings: {},
    tourDone: false,
    localVersions: [],
    ignored: [],
    unknown: [],
    invalid: [],
  };

  const set = <K extends SettingKey>(oldKey: string, key: K, value: Settings[K] | undefined): void => {
    const parsed = value === undefined ? undefined : parseSetting(key, value);
    if (!parsed) {
      result.invalid.push(oldKey);
      return;
    }
    if (!sameValue(parsed.value, defaultSettings[key])) settings[key] = parsed.value;
  };

  for (const [key, raw] of Object.entries(values)) {
    if (IGNORED_KEYS.has(key)) {
      result.ignored.push(key);
      continue;
    }
    if (!MAPPED_KEYS.has(key)) {
      result.unknown.push(key);
      continue;
    }
    switch (key) {
      case 'fontFamily':
        set(key, 'editorFontFamily', raw);
        break;
      case 'fontSize': {
        const size = Number.parseInt(raw, 10);
        set(key, 'editorFontSize', Number.isFinite(size) ? size : undefined);
        break;
      }
      case 'isClearingConsoleOnRun':
        set(key, 'clearConsoleOnRun', parseBool(raw));
        break;
      case 'isPublishingGistAsRevision':
        set(key, 'gistPublishAsRevision', parseBool(raw));
        break;
      case 'isShowingGistHistory':
        set(key, 'gistShowHistory', parseBool(raw));
        break;
      case 'gitHubPublishAsPublic': {
        const isPublic = parseBool(raw);
        set(key, 'gistVisibility', isPublic === undefined ? undefined : isPublic ? 'public' : 'secret');
        break;
      }
      case 'packageAuthor':
        if (raw !== osUser) set(key, 'packageAuthor', raw);
        break;
      case 'acceleratorsToBlock': {
        const blocked = strings(parseJson(raw));
        const keybindings: Record<string, null> = {};
        for (const name of blocked ?? []) {
          const command = BLOCKABLE[name];
          if (command) keybindings[command] = null;
        }
        set(key, 'keybindings', blocked ? keybindings : undefined);
        break;
      }
      case 'electronMirror': {
        const mirror = parseJson(raw) as {
          sourceType?: unknown;
          sources?: { CUSTOM?: { electronMirror?: unknown; electronNightlyMirror?: unknown } };
        } | null;
        // The old default was a fixed "DEFAULT"; the new default picks by locale.
        if (mirror?.sourceType === 'CHINA') set(key, 'mirror', 'china');
        else if (mirror?.sourceType === 'CUSTOM') {
          const custom = mirror.sources?.CUSTOM;
          set(key, 'mirror', 'custom');
          if (typeof custom?.electronMirror === 'string') {
            set(key, 'customMirrorElectron', custom.electronMirror);
          }
          if (typeof custom?.electronNightlyMirror === 'string') {
            set(key, 'customMirrorNightly', custom.electronNightlyMirror);
          }
        } else if (mirror?.sourceType !== 'DEFAULT') result.invalid.push(key);
        break;
      }
      case 'channelsToShow':
        set(
          key,
          'channels',
          strings(parseJson(raw))?.map((channel) => channel.toLowerCase()) as Settings['channels'],
        );
        break;
      case 'showUndownloadedVersions':
        set(key, 'showNotDownloaded', parseBool(raw));
        break;
      case 'showObsoleteVersions':
        set(key, 'showObsolete', parseBool(raw));
        break;
      case 'isKeepingUserDataDirs':
        set(key, 'keepUserDataDirs', parseBool(raw));
        break;
      case 'isEnablingElectronLogging':
        set(key, 'electronLogging', parseBool(raw));
        break;
      case 'executionFlags':
        set(key, 'electronFlags', strings(parseJson(raw))?.filter((flag) => flag.trim() !== ''));
        break;
      case 'environmentVariables':
        set(
          key,
          'environmentVariables',
          strings(parseJson(raw))?.filter((entry) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(entry)),
        );
        break;
      case 'packageManager':
        set(key, 'packageManager', raw as Settings['packageManager']);
        break;
      case 'isUsingSocketFirewall':
        set(key, 'socketFirewall', parseBool(raw));
        break;
      case 'hasShownTour':
        result.tourDone = raw === 'true';
        break;
      case 'gitHubLogin':
        if (raw) result.gitHubLogin = raw;
        break;
      case 'local-electron-versions': {
        const list = parseJson(raw);
        for (const entry of Array.isArray(list) ? list : []) {
          const { version, localPath, name } = (entry ?? {}) as Record<string, unknown>;
          if (typeof version === 'string' && typeof localPath === 'string') {
            result.localVersions.push({ version, localPath, ...(typeof name === 'string' ? { name } : {}) });
          }
        }
        break;
      }
      // `theme` and `isUsingSystemTheme` are read together below.
    }
  }

  // The old "system theme" switched between the two built-in themes, ignoring `theme`.
  const followSystem = parseBool(values.isUsingSystemTheme) ?? true;
  if (!followSystem) {
    const theme = values.theme;
    if (theme === undefined || theme === '' || theme === BUILTIN_DARK) set('theme', 'appearance', 'dark');
    else if (theme === BUILTIN_LIGHT) set('theme', 'appearance', 'light');
    else {
      const id = themeIds.get(oldThemeKey(theme));
      if (id) set('theme', 'theme', id);
      else set('theme', 'appearance', 'dark');
    }
  }

  result.settings = settings as SparseSettings;
  return result;
}
