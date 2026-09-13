/**
 * Settings: the zod schema with a default for every setting (REQUIREMENTS
 * §17.13), plus the pure helpers main and the renderer share.
 *
 * - `<userData>/settings.json` stores only values that differ from the
 *   defaults (sparse). The defaults live here, in code.
 * - The `App` store carries the full, effective `settings`.
 * - `keybindings` holds overrides only: `{ [commandId]: accelerator | null }`,
 *   where `null` unbinds the command.
 */
import { z } from 'zod';

import { acceleratorFor, commandIds, type CommandId } from './commands';
import type { Platform } from './stores';

/** The built-in theme: Lucent dark or Lucent light, following `appearance`. */
export const BUILTIN_THEME = 'lucent';

export const releaseChannelSchema = z.enum(['stable', 'beta', 'nightly']);
export type ReleaseChannel = z.infer<typeof releaseChannelSchema>;

/** `auto` picks the China mirror for Chinese system locales, otherwise the default. */
export const mirrorSchema = z.enum(['auto', 'default', 'china', 'custom']);
export type Mirror = z.infer<typeof mirrorSchema>;

export const MIRRORS = {
  default: {
    electron: 'https://github.com/electron/electron/releases/download/',
    nightly: 'https://github.com/electron/nightlies/releases/download/',
  },
  china: {
    electron: 'https://npmmirror.com/mirrors/electron/',
    nightly: 'https://npmmirror.com/mirrors/electron-nightly/',
  },
} as const;

const mirrorUrl = z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(2000)]);
/** Theme IDs are file names in `<userData>/themes/`, without `.json`. */
export const themeIdSchema = z.string().regex(/^[A-Za-z0-9][\w.-]{0,99}$/);
export const acceleratorSchema = z.string().min(1).max(100);

export const settingsSchema = z.object({
  // General
  appearance: z.enum(['system', 'light', 'dark']).default('system'),
  theme: themeIdSchema.default(BUILTIN_THEME),
  /** `system` or a language code such as `de` or `pt-BR`. */
  locale: z
    .string()
    .regex(/^(system|[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*)$/)
    .default('system'),
  sessionRestore: z.boolean().default(true),
  notifications: z.boolean().default(true),

  // Editor. Empty or null means Lucent's default.
  editorFontFamily: z
    .string()
    .max(200)
    .regex(/^[^;{}<>\\()]*$/)
    .default(''),
  editorFontSize: z.number().int().min(8).max(40).nullable().default(null),

  // Execution
  clearConsoleOnRun: z.boolean().default(false),
  electronFlags: z.array(z.string().min(1).max(1000)).max(100).default([]),
  /** `KEY=value` entries. */
  environmentVariables: z
    .array(z.string().max(10_000).regex(/^[A-Za-z_][A-Za-z0-9_]*=/))
    .max(100)
    .default([]),
  packageManager: z.enum(['npm', 'yarn']).default('npm'),
  socketFirewall: z.boolean().default(true),
  keepUserDataDirs: z.boolean().default(false),
  electronLogging: z.boolean().default(false),

  // Electron
  channels: z.array(releaseChannelSchema).default(['stable', 'beta']),
  showNotDownloaded: z.boolean().default(true),
  showObsolete: z.boolean().default(false),
  mirror: mirrorSchema.default('auto'),
  customMirrorElectron: mirrorUrl.default(''),
  customMirrorNightly: mirrorUrl.default(''),

  // GitHub. An empty author means the OS user name.
  packageAuthor: z.string().max(200).default(''),
  gistShowHistory: z.boolean().default(true),
  gistPublishAsRevision: z.boolean().default(true),
  gistVisibility: z.enum(['secret', 'public']).default('secret'),

  // Accessibility, privacy, updates
  screenReader: z.enum(['auto', 'on', 'off']).default('auto'),
  crashReports: z.boolean().default(true),
  betaUpdates: z.boolean().default(false),

  keybindings: z.record(z.string().min(1).max(100), acceleratorSchema.nullable()).default({}),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;
export type Keybindings = Settings['keybindings'];

export const settingKeys = Object.keys(settingsSchema.shape) as SettingKey[];
export const defaultSettings: Settings = settingsSchema.parse({});

/** EIPC argument schemas (see `interface Settings` in fiddle.eipc). */
export const settingKeySchema = z.enum(settingKeys as [SettingKey, ...SettingKey[]]);
export const settingValueSchema = z.unknown();
export type SettingValue = z.infer<typeof settingValueSchema>;

// Themes (REQUIREMENTS §17.12). Custom themes are `<userData>/themes/<id>.json`.

const HEX = /^#?[0-9a-fA-F]{3,8}$/;
const CSS_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([\d\s.,%/+-]*\)$/i;
const FONT_FAMILY = /^[\w\s"',.-]+$/;

/** A colour or font value that is safe to set as a CSS variable. */
export function isSafeTokenValue(name: string, value: string): boolean {
  if (/url\(|[;{}<>\\@]/i.test(value)) return false;
  if (/font/i.test(name)) return FONT_FAMILY.test(value);
  return HEX.test(value) || CSS_FUNCTION.test(value) || /^[a-z]+$/i.test(value);
}

const monacoColor = z.string().regex(HEX);

/** Monaco `IStandaloneThemeData`, loosely: an imported theme needs `base` or `rules`. */
export const monacoThemeSchema = z
  .object({
    base: z.enum(['vs', 'vs-dark', 'hc-black', 'hc-light']).optional(),
    inherit: z.boolean().optional(),
    rules: z
      .array(
        z.object({
          token: z.string().max(200),
          foreground: monacoColor.optional(),
          background: monacoColor.optional(),
          fontStyle: z.string().max(50).regex(/^[a-z ]*$/).optional(),
        }),
      )
      .max(5000)
      .optional(),
    colors: z.record(z.string().max(200), monacoColor).optional(),
  })
  .refine((theme) => theme.base !== undefined || theme.rules !== undefined, {
    message: 'A Monaco theme needs `base` or `rules`',
  });
export type MonacoTheme = z.infer<typeof monacoThemeSchema>;

/** `common` keys are Lucent token names without the prefix: `accent` sets `--lu-accent`. */
export const themeTokensSchema = z
  .record(z.string().regex(/^[a-z][a-z0-9-]{0,60}$/), z.string().max(300))
  .refine((tokens) => Object.entries(tokens).every(([name, value]) => isSafeTokenValue(name, value)), {
    message: 'Theme tokens must be colours or font names',
  });

export const themeFileSchema = z.object({
  name: z.string().min(1).max(100),
  isDark: z.boolean(),
  editor: monacoThemeSchema.optional(),
  common: themeTokensSchema.default({}),
});
export type ThemeFile = z.infer<typeof themeFileSchema>;

export const themeDataSchema = themeFileSchema.extend({ id: themeIdSchema });
export type ThemeData = z.infer<typeof themeDataSchema>;

export const themeSummarySchema = z.object({
  id: themeIdSchema,
  name: z.string(),
  isDark: z.boolean(),
});
export type ThemeSummary = z.infer<typeof themeSummarySchema>;

/** A data file that was corrupt or written by a newer app version. */
export const storageNoticeSchema = z.object({
  id: z.string(),
  kind: z.enum(['corrupt', 'newer-version']),
  /** The file's base name, e.g. `settings.json`. */
  file: z.string(),
});
export type StorageNotice = z.infer<typeof storageNoticeSchema>;

/** What `settings.json` holds: only the values that differ from the defaults. */
export type SparseSettings = Partial<Settings>;

/** Validates one value against its key's schema. Returns undefined when invalid. */
export function parseSetting<K extends SettingKey>(
  key: K,
  value: unknown,
): { value: Settings[K] } | undefined {
  const result = settingsSchema.shape[key].safeParse(value);
  return result.success ? { value: result.data as Settings[K] } : undefined;
}

/** Structural equality for JSON values; object key order doesn't matter. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

export function isModified(settings: Settings, key: SettingKey): boolean {
  return !sameValue(settings[key], defaultSettings[key]);
}

export function toSparse(settings: Settings): SparseSettings {
  const sparse: Record<string, unknown> = {};
  for (const key of settingKeys) if (isModified(settings, key)) sparse[key] = settings[key];
  return sparse as SparseSettings;
}

export function fromSparse(sparse: SparseSettings): Settings {
  const settings: Record<string, unknown> = { ...defaultSettings };
  for (const key of settingKeys) if (sparse[key] !== undefined) settings[key] = sparse[key];
  return settings as Settings;
}

/** The download mirror for a channel, resolving `auto` from the system locales. */
export function resolveMirror(
  settings: Pick<Settings, 'mirror' | 'customMirrorElectron' | 'customMirrorNightly'>,
  systemLocales: readonly string[],
): { electron: string; nightly: string } {
  switch (settings.mirror) {
    case 'custom':
      return {
        electron: settings.customMirrorElectron || MIRRORS.default.electron,
        nightly: settings.customMirrorNightly || MIRRORS.default.nightly,
      };
    case 'china':
      return MIRRORS.china;
    case 'default':
      return MIRRORS.default;
    case 'auto':
      return /^zh(-|$)/i.test(systemLocales[0] ?? '') ? MIRRORS.china : MIRRORS.default;
  }
}

/** Locales to pick the UI language from: the setting first (unless `system`), then the OS's. */
export function localePreference(setting: string, system: readonly string[]): string[] {
  return setting === 'system' ? [...system] : [setting, ...system];
}

/** The screen-reader mode Monaco should use. `auto` follows the OS. */
export function resolveScreenReader(
  setting: Settings['screenReader'],
  osEnabled: boolean,
): boolean {
  return setting === 'auto' ? osEnabled : setting === 'on';
}

// Keybindings

/** The accelerator a command has after overrides, or undefined when it has none or is unbound. */
export function effectiveAccelerator(
  id: CommandId,
  platform: Platform,
  keybindings: Keybindings,
): string | undefined {
  if (Object.hasOwn(keybindings, id)) return keybindings[id] ?? undefined;
  return acceleratorFor(id, platform);
}

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'AltGr', 'Shift', 'Cmd', 'Super'] as const;

/**
 * A canonical form for comparing accelerators on one platform:
 * `CmdOrCtrl+Shift+p` and `Shift+Ctrl+P` are the same on Windows.
 */
export function normalizeAccelerator(accelerator: string, platform: Platform): string {
  const isMac = platform === 'darwin';
  const modifiers = new Set<string>();
  let key = '';
  for (const part of accelerator.split(/\+(?!$)/)) {
    switch (part.toLowerCase()) {
      case 'cmdorctrl':
      case 'commandorcontrol':
        modifiers.add(isMac ? 'Cmd' : 'Ctrl');
        break;
      case 'cmd':
      case 'command':
        modifiers.add('Cmd');
        break;
      case 'ctrl':
      case 'control':
        modifiers.add('Ctrl');
        break;
      case 'alt':
      case 'option':
        modifiers.add('Alt');
        break;
      case 'altgr':
        modifiers.add('AltGr');
        break;
      case 'shift':
        modifiers.add('Shift');
        break;
      case 'super':
      case 'meta':
        modifiers.add(isMac ? 'Cmd' : 'Super');
        break;
      default:
        key = part.length === 1 ? part.toUpperCase() : part.toLowerCase();
    }
  }
  return [...MODIFIER_ORDER.filter((m) => modifiers.has(m)), key].join('+');
}

/** Commands that share an accelerator: normalized accelerator → command IDs (two or more). */
export function findConflicts(
  platform: Platform,
  keybindings: Keybindings,
  ids: readonly CommandId[] = commandIds,
): Map<string, CommandId[]> {
  const byAccelerator = new Map<string, CommandId[]>();
  for (const id of ids) {
    const accelerator = effectiveAccelerator(id, platform, keybindings);
    if (!accelerator) continue;
    const key = normalizeAccelerator(accelerator, platform);
    byAccelerator.set(key, [...(byAccelerator.get(key) ?? []), id]);
  }
  return new Map([...byAccelerator].filter(([, list]) => list.length > 1));
}

export interface KeyInput {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const NAMED_KEYS: Record<string, string> = {
  ' ': 'Space',
  '+': 'Plus',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Escape: 'Esc',
};

/**
 * Turns a key press into an Electron accelerator, or undefined while only
 * modifiers are held. The platform's primary modifier becomes `CmdOrCtrl`.
 */
export function acceleratorFromKey(input: KeyInput, platform: Platform): string | undefined {
  if (['Meta', 'Control', 'Alt', 'Shift', 'AltGraph', 'OS'].includes(input.key)) return undefined;
  let key: string | undefined = NAMED_KEYS[input.key];
  if (!key && /^F([1-9]|1\d|2[0-4])$/.test(input.key)) key = input.key;
  // Prefer the physical key for letters and digits, so Alt+letter on macOS isn't "å".
  if (!key && input.code) {
    const match = /^(?:Key([A-Z])|Digit(\d))$/.exec(input.code);
    if (match) key = match[1] ?? match[2];
  }
  if (!key && input.key.length === 1) key = input.key.toUpperCase();
  if (!key) return undefined;

  const isMac = platform === 'darwin';
  const parts: string[] = [];
  if (isMac ? input.metaKey : input.ctrlKey) parts.push('CmdOrCtrl');
  if (isMac && input.ctrlKey) parts.push('Ctrl');
  if (!isMac && input.metaKey) parts.push('Super');
  if (input.altKey) parts.push('Alt');
  if (input.shiftKey) parts.push('Shift');
  return [...parts, key].join('+');
}
