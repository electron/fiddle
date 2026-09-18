/**
 * Themes. Built in: Lucent, dark or light, and its high-contrast dark and
 * light variants. Custom themes are JSON files in
 * `<userData>/themes/<id>.json` holding a `schemaVersion`, a name, `isDark`,
 * Monaco `editor` data and Lucent `common` tokens. Every file is validated
 * with the shared schema: token values must be colours or font names, and
 * `url(` is rejected.
 *
 * No Electron imports.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';

import { isWindowsReservedName } from '../../fiddle/files';
import { ErrorCode, FiddleError } from '../../shared/errors';
import {
  BUILTIN_THEME,
  HIGH_CONTRAST_THEMES,
  isBuiltinTheme,
  monacoThemeSchema,
  THEME_SCHEMA_VERSION,
  themeFileSchema,
  themeIdSchema,
  type Settings,
  type ThemeData,
  type ThemeFile,
  type ThemeSummary,
} from '../../shared/settings';
import { log } from '../log';
import { writeAtomic } from '../persistence/json-store';

/**
 * Parses one theme file. Returns undefined (and logs) when it isn't a valid
 * theme. A file from a newer app version is shown as far as this one
 * understands it; the app never writes existing theme files.
 */
export function parseTheme(id: string, text: string): ThemeData | undefined {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    log.warn('theme is not valid JSON', id);
    return undefined;
  }
  const result = themeFileSchema.safeParse(data);
  if (!result.success) {
    log.warn('invalid theme', id, result.error.message);
    return undefined;
  }
  if ((result.data.schemaVersion ?? 1) > THEME_SCHEMA_VERSION)
    log.warn('theme is from a newer version', id);
  return { ...result.data, id };
}

/** Every valid theme in `dir`, sorted by name in the UI `locale`. */
export async function loadThemes(dir: string, locale?: string): Promise<ThemeData[]> {
  let names: string[];
  try {
    names = await fsp.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      log.error('failed to list themes', error);
    return [];
  }
  const themes: ThemeData[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    if (isBuiltinTheme(id) || !themeIdSchema.safeParse(id).success) continue;
    try {
      const theme = parseTheme(id, await fsp.readFile(path.join(dir, name), 'utf8'));
      if (theme) themes.push(theme);
    } catch (error) {
      log.warn('failed to read theme', name, error);
    }
  }
  return themes.sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function summarize(theme: ThemeData): ThemeSummary {
  return { id: theme.id, name: theme.name, isDark: theme.isDark };
}

/** `nativeTheme.themeSource` for the settings: a custom or high-contrast theme sets light or dark itself. */
export function themeSource(
  settings: Pick<Settings, 'appearance' | 'theme'>,
  themes: readonly ThemeSummary[],
): 'system' | 'light' | 'dark' {
  if (settings.theme === HIGH_CONTRAST_THEMES.dark) return 'dark';
  if (settings.theme === HIGH_CONTRAST_THEMES.light) return 'light';
  if (settings.theme !== BUILTIN_THEME) {
    const theme = themes.find((candidate) => candidate.id === settings.theme);
    if (theme) return theme.isDark ? 'dark' : 'light';
  }
  return settings.appearance;
}

function isDarkColor(hex: string | undefined): boolean | undefined {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex ?? '');
  if (!match) return undefined;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! < 128;
}

/** Turns an imported Monaco theme into a theme file. Throws `invalid-argument` if it isn't one. */
export function themeFromMonaco(name: string, data: unknown): ThemeFile {
  const result = monacoThemeSchema.safeParse(data);
  if (!result.success) {
    throw new FiddleError(
      ErrorCode.invalidArgument,
      'Not a Monaco theme',
      result.error.message,
    );
  }
  const editor = result.data;
  const isDark =
    editor.base !== undefined
      ? editor.base === 'vs-dark' || editor.base === 'hc-black'
      : (isDarkColor(editor.colors?.['editor.background']) ?? true);
  return { name: name.slice(0, 100) || 'Theme', isDark, editor, common: {} };
}

/** A file-name-safe ID for a theme name that doesn't clash with `taken` or a built-in theme. */
export function themeId(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'theme';
  // `con.json` is a device on Windows.
  let id =
    isBuiltinTheme(base) || isWindowsReservedName(`${base}.json`)
      ? `${base}-custom`
      : base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Writes a new theme file with the current `schemaVersion`, atomically
 * (`writeAtomic`), and returns its path. Never overwrites: an existing file
 * fails with `EEXIST`.
 */
export async function writeTheme(
  dir: string,
  id: string,
  theme: ThemeFile,
): Promise<string> {
  const file = path.join(dir, `${id}.json`);
  const exists = await fsp.stat(file).then(
    () => true,
    () => false,
  );
  if (exists)
    throw Object.assign(new Error(`${file} already exists`), { code: 'EEXIST' });
  const { schemaVersion: _ignored, ...data } = theme;
  await writeAtomic(
    file,
    `${JSON.stringify({ schemaVersion: THEME_SCHEMA_VERSION, ...data }, null, 2)}\n`,
  );
  return file;
}
