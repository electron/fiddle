/**
 * `settings.json` stores only values that differ from the defaults; the defaults
 * live here. `keybindings` holds overrides only, and `null` unbinds a command.
 */
import { z } from 'zod';

import {
  acceleratorsFor,
  commandIds,
  getCommand,
  isCommandId,
  keyContexts,
  type CommandId,
  type KeyContext,
} from './commands';
import { DEFAULT_ENDPOINTS } from './endpoints';
import type { Platform } from './stores';

/** The built-in theme: Lucent dark or Lucent light, following `appearance`. */
export const BUILTIN_THEME = 'lucent';

/** The built-in high-contrast themes. OS high contrast shows Lucent this way too. */
export const HIGH_CONTRAST_THEMES = {
  dark: 'lucent-hc-dark',
  light: 'lucent-hc-light',
} as const;

/** Lucent and its high-contrast variants: themes without a file. */
export function isBuiltinTheme(id: string): boolean {
  return (
    id === BUILTIN_THEME ||
    id === HIGH_CONTRAST_THEMES.dark ||
    id === HIGH_CONTRAST_THEMES.light
  );
}

export const releaseChannelSchema = z.enum(['stable', 'beta', 'nightly']);
export type ReleaseChannel = z.infer<typeof releaseChannelSchema>;

/** `auto` picks the China mirror for Chinese system locales, otherwise the default. */
export const mirrorSchema = z.enum(['auto', 'default', 'china', 'custom']);
export type Mirror = z.infer<typeof mirrorSchema>;

export const MIRRORS = {
  default: {
    electron: DEFAULT_ENDPOINTS.electronMirror,
    nightly: DEFAULT_ENDPOINTS.electronNightlyMirror,
  },
  china: {
    electron: 'https://npmmirror.com/mirrors/electron/',
    nightly: 'https://npmmirror.com/mirrors/electron-nightly/',
  },
} as const;

/** Custom mirrors serve the Electron binaries Fiddle runs, so only https is accepted. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const mirrorUrl = z.union([z.literal(''), z.url({ protocol: /^https$/ }).max(2000)]);

/** Settings that change what a run executes, how modules install, or where Electron comes from. */
export const EXECUTION_SETTINGS = [
  'electronFlags',
  'environmentVariables',
  'mirror',
  'customMirrorElectron',
  'customMirrorNightly',
  'packageManager',
  'socketFirewall',
] as const;

/** The execution settings `next` changes from `current`, e.g. for the settings import confirmation. */
export function changedExecutionSettings(
  current: Settings,
  next: Settings,
): (typeof EXECUTION_SETTINGS)[number][] {
  return EXECUTION_SETTINGS.filter(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(next[key]),
  );
}
/** Theme IDs are file names in `<userData>/themes/`, without `.json`. */
export const themeIdSchema = z.string().regex(/^[A-Za-z0-9][\w.-]{0,99}$/);
export const acceleratorSchema = z.string().min(1).max(100);

export const settingsSchema = z.object({
  appearance: z.enum(['system', 'light', 'dark']).default('system'),
  theme: themeIdSchema.default(BUILTIN_THEME),
  /** `system` or a language code such as `de` or `pt-BR`. */
  locale: z
    .string()
    .regex(/^(system|[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*)$/)
    .default('system'),
  sessionRestore: z.boolean().default(true),
  notifications: z.boolean().default(true),

  // Editor font: empty or null means Lucent's default.
  editorFontFamily: z
    .string()
    .max(200)
    .regex(/^[^;{}<>\\()]*$/)
    .default(''),
  editorFontSize: z.number().int().min(8).max(40).nullable().default(null),

  clearConsoleOnRun: z.boolean().default(false),
  electronFlags: z.array(z.string().min(1).max(1000)).max(100).default([]),
  /** `KEY=value` entries. */
  environmentVariables: z
    .array(
      z
        .string()
        .max(10_000)
        .regex(/^[A-Za-z_][A-Za-z0-9_]*=/),
    )
    .max(100)
    .default([]),
  packageManager: z.enum(['npm', 'yarn']).default('npm'),
  socketFirewall: z.boolean().default(true),
  keepUserDataDirs: z.boolean().default(false),
  electronLogging: z.boolean().default(false),

  channels: z.array(releaseChannelSchema).default(['stable', 'beta']),
  showNotDownloaded: z.boolean().default(true),
  showObsolete: z.boolean().default(false),
  mirror: mirrorSchema.default('auto'),
  customMirrorElectron: mirrorUrl.default(''),
  customMirrorNightly: mirrorUrl.default(''),

  // An empty author means the OS user name.
  packageAuthor: z.string().max(200).default(''),
  gistShowHistory: z.boolean().default(true),
  gistPublishAsRevision: z.boolean().default(true),
  gistVisibility: z.enum(['secret', 'public']).default('secret'),

  screenReader: z.enum(['auto', 'on', 'off']).default('auto'),
  crashReports: z.boolean().default(true),

  keybindings: z
    .record(z.string().min(1).max(100), acceleratorSchema.nullable())
    .default({}),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;
export type Keybindings = Settings['keybindings'];

export const settingKeys = Object.keys(settingsSchema.shape) as SettingKey[];
export const defaultSettings: Settings = settingsSchema.parse({});

/** EIPC argument schemas. */
export const settingKeySchema = z.enum(settingKeys as [SettingKey, ...SettingKey[]]);
export const settingValueSchema = z.unknown();
export type SettingValue = z.infer<typeof settingValueSchema>;

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
          fontStyle: z
            .string()
            .max(50)
            .regex(/^[a-z ]*$/)
            .optional(),
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
  .refine(
    (tokens) =>
      Object.entries(tokens).every(([name, value]) => isSafeTokenValue(name, value)),
    {
      message: 'Theme tokens must be colours or font names',
    },
  );

/** Written into every theme file. Files without one are version 1. */
export const THEME_SCHEMA_VERSION = 1;

export const themeFileSchema = z.object({
  schemaVersion: z.number().int().positive().optional(),
  name: z.string().min(1).max(100),
  isDark: z.boolean(),
  editor: monacoThemeSchema.optional(),
  common: themeTokensSchema.default({}),
});
export type ThemeFile = z.infer<typeof themeFileSchema>;

export const themeDataSchema = themeFileSchema.extend({ id: themeIdSchema });
export type ThemeData = z.infer<typeof themeDataSchema>;

/** A built-in theme as the renderer draws it: its Monaco theme and token values ("Create from current"). */
export const themeSnapshotSchema = z.object({
  isDark: z.boolean(),
  editor: monacoThemeSchema,
  common: themeTokensSchema,
});
export type ThemeSnapshot = z.infer<typeof themeSnapshotSchema>;

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
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null)
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameValue(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}

export function isModified(settings: Settings, key: SettingKey): boolean {
  return !sameValue(settings[key], defaultSettings[key]);
}

export function toSparse(settings: Settings): SparseSettings {
  const sparse: Record<string, unknown> = {};
  for (const key of settingKeys)
    if (isModified(settings, key)) sparse[key] = settings[key];
  return sparse as SparseSettings;
}

export function fromSparse(sparse: SparseSettings): Settings {
  const settings: Record<string, unknown> = { ...defaultSettings };
  for (const key of settingKeys)
    if (sparse[key] !== undefined) settings[key] = sparse[key];
  return settings as Settings;
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

/**
 * A command's keybindings after overrides. An override (or `null`) replaces
 * all of the command's defaults, so overriding `run.toggle` drops F5 too.
 */
export function effectiveAccelerators(
  id: CommandId,
  platform: Platform,
  keybindings: Keybindings,
): string[] {
  if (Object.hasOwn(keybindings, id)) {
    const override = keybindings[id];
    return override ? [override] : [];
  }
  return acceleratorsFor(id, platform);
}

/** The accelerator menus show after overrides, or undefined when it has none or is unbound. */
export function effectiveAccelerator(
  id: CommandId,
  platform: Platform,
  keybindings: Keybindings,
): string | undefined {
  return effectiveAccelerators(id, platform, keybindings)[0];
}

/** What has focus, or was right-clicked, in a window (`Window.ReportContextMenu`). */
export const focusContextSchema = z.enum(['editor', 'console', 'other']);
export type FocusContext = z.infer<typeof focusContextSchema>;

/** One key that runs a command; `context` limits where. */
export interface Keybinding {
  id: CommandId;
  accelerator: string;
  context?: KeyContext;
}

function isKeyContext(value: string): value is KeyContext {
  return (keyContexts as readonly string[]).includes(value);
}

/**
 * Every keybinding after overrides. An override key `<commandId>@<context>`
 * adds a binding that only applies in that context, e.g.
 * `{ "run.toggle@editor": "CmdOrCtrl+Enter" }`; `null` there adds none.
 */
export function resolveKeybindings(
  platform: Platform,
  keybindings: Keybindings,
  ids: readonly CommandId[] = commandIds,
): Keybinding[] {
  const bindings: Keybinding[] = [];
  const add = (id: CommandId, accelerator: string, context: KeyContext | undefined) =>
    bindings.push(context ? { id, accelerator, context } : { id, accelerator });
  for (const id of ids) {
    for (const accelerator of effectiveAccelerators(id, platform, keybindings))
      add(id, accelerator, getCommand(id).context);
  }
  for (const [key, accelerator] of Object.entries(keybindings)) {
    const at = key.lastIndexOf('@');
    if (at < 0 || !accelerator) continue;
    const id = key.slice(0, at);
    const context = key.slice(at + 1);
    if (isCommandId(id) && ids.includes(id) && isKeyContext(context))
      add(id, accelerator, context);
  }
  return bindings;
}

/** The editor and the console never have focus together; the fiddle runs whatever has focus. */
function contextsOverlap(a: KeyContext | undefined, b: KeyContext | undefined): boolean {
  return (
    a === undefined || b === undefined || a === b || a === 'running' || b === 'running'
  );
}

/**
 * The binding a key press runs, given the contexts that are active. A scoped
 * binding wins over one that applies everywhere.
 */
export function matchKeybinding(
  bindings: readonly Keybinding[],
  accelerator: string,
  active: ReadonlySet<KeyContext>,
  platform: Platform,
): Keybinding | undefined {
  const key = normalizeAccelerator(accelerator, platform);
  let everywhere: Keybinding | undefined;
  for (const binding of bindings) {
    if (normalizeAccelerator(binding.accelerator, platform) !== key) continue;
    if (binding.context === undefined) everywhere ??= binding;
    else if (active.has(binding.context)) return binding;
  }
  return everywhere;
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
      // Electron's synonyms for the same key.
      case 'plus':
        key = '+';
        break;
      case 'escape':
        key = 'esc';
        break;
      case 'return':
        key = 'enter';
        break;
      default:
        key = part.length === 1 ? part.toUpperCase() : part.toLowerCase();
    }
  }
  return [...MODIFIER_ORDER.filter((m) => modifiers.has(m)), key].join('+');
}

/**
 * Commands that share an accelerator where both can apply: normalized
 * accelerator → command IDs (two or more). Covers every binding, second
 * defaults such as F5 and F1 and scoped overrides included.
 */
export function findConflicts(
  platform: Platform,
  keybindings: Keybindings,
  ids: readonly CommandId[] = commandIds,
): Map<string, CommandId[]> {
  const byAccelerator = new Map<string, Keybinding[]>();
  for (const binding of resolveKeybindings(platform, keybindings, ids)) {
    const key = normalizeAccelerator(binding.accelerator, platform);
    byAccelerator.set(key, [...(byAccelerator.get(key) ?? []), binding]);
  }
  const conflicts = new Map<string, CommandId[]>();
  for (const [key, list] of byAccelerator) {
    const clashing = new Set<CommandId>();
    for (const a of list) {
      if (list.some((b) => b.id !== a.id && contextsOverlap(a.context, b.context)))
        clashing.add(a.id);
    }
    if (clashing.size > 1) conflicts.set(key, [...clashing]);
  }
  return conflicts;
}

export interface KeyInput {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** A `KeyboardEvent` has it. Tells AltGr, which types a character, from a Ctrl+Alt shortcut. */
  getModifierState?: (key: string) => boolean;
}

const ASCII_PRINTABLE = /^[\x20-\x7e]$/;

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
export function acceleratorFromKey(
  input: KeyInput,
  platform: Platform,
): string | undefined {
  if (['Meta', 'Control', 'Alt', 'Shift', 'AltGraph', 'OS'].includes(input.key))
    return undefined;
  if (input.key.length === 1 && input.getModifierState?.('AltGraph')) return undefined;
  let key: string | undefined = NAMED_KEYS[input.key];
  if (!key && /^F([1-9]|1\d|2[0-4])$/.test(input.key)) key = input.key;
  // What the user typed on their layout (AZERTY, Dvorak, ...) is what accelerators name.
  if (!key && /^[a-z0-9]$/i.test(input.key)) key = input.key.toUpperCase();
  // The physical key stands in where the typed character isn't a Latin letter or digit:
  // a non-Latin layout, macOS Option ("å"), or a symbol on the digit row ("&" on AZERTY, "!" with Shift).
  if (!key && input.code) {
    const match = /^(?:Key([A-Z])|Digit(\d))$/.exec(input.code);
    if (match && (match[2] || !ASCII_PRINTABLE.test(input.key)))
      key = match[1] ?? match[2];
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
