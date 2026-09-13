/**
 * Themes (REQUIREMENTS §17.12). The built-in theme is Lucent, dark or light.
 * Custom themes are JSON files in `<userData>/themes/<id>.json` holding a
 * name, `isDark`, Monaco `editor` data and Lucent `common` tokens. Every file
 * is validated with the shared schema: token values must be colours or font
 * names, and `url(` is rejected.
 *
 * No Electron imports.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';

import { ErrorCode, FiddleError } from '../../shared/errors';
import {
  BUILTIN_THEME,
  monacoThemeSchema,
  themeFileSchema,
  themeIdSchema,
  type Settings,
  type ThemeData,
  type ThemeFile,
  type ThemeSummary,
} from '../../shared/settings';
import { log } from '../log';

/** Parses one theme file. Returns undefined (and logs) when it isn't a valid theme. */
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
  return { ...result.data, id };
}

export async function loadThemes(dir: string): Promise<ThemeData[]> {
  let names: string[];
  try {
    names = await fsp.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') log.error('failed to list themes', error);
    return [];
  }
  const themes: ThemeData[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    if (id === BUILTIN_THEME || !themeIdSchema.safeParse(id).success) continue;
    try {
      const theme = parseTheme(id, await fsp.readFile(path.join(dir, name), 'utf8'));
      if (theme) themes.push(theme);
    } catch (error) {
      log.warn('failed to read theme', name, error);
    }
  }
  return themes.sort((a, b) => a.name.localeCompare(b.name));
}

export function summarize(theme: ThemeData): ThemeSummary {
  return { id: theme.id, name: theme.name, isDark: theme.isDark };
}

/** `nativeTheme.themeSource` for the settings: a custom theme sets light or dark itself. */
export function themeSource(
  settings: Pick<Settings, 'appearance' | 'theme'>,
  themes: readonly ThemeSummary[],
): 'system' | 'light' | 'dark' {
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
    throw new FiddleError(ErrorCode.invalidArgument, 'Not a Monaco theme', result.error.message);
  }
  const editor = result.data;
  const isDark =
    editor.base !== undefined
      ? editor.base === 'vs-dark' || editor.base === 'hc-black'
      : (isDarkColor(editor.colors?.['editor.background']) ?? true);
  return { name: name.slice(0, 100) || 'Theme', isDark, editor, common: {} };
}

/** A few Lucent tokens to start from, so a new theme file shows how `common` works. */
const STARTER_TOKENS = {
  dark: { accent: '#9feaf9', surface: '#1b1c26', ink: '#eef1f8' },
  light: { accent: '#006f85', surface: '#ffffff', ink: '#1b1c26' },
} as const;

export function builtinThemeFile(name: string, isDark: boolean): ThemeFile {
  return {
    name,
    isDark,
    editor: { base: isDark ? 'vs-dark' : 'vs', inherit: true, rules: [], colors: {} },
    common: { ...STARTER_TOKENS[isDark ? 'dark' : 'light'] },
  };
}

/** A file-name-safe ID for a theme name that doesn't clash with `taken`. */
export function themeId(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'theme';
  let id = base === BUILTIN_THEME ? `${base}-custom` : base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Writes a new theme file and returns its path. Never overwrites. */
export async function writeTheme(dir: string, id: string, theme: ThemeFile): Promise<string> {
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  await fsp.writeFile(file, `${JSON.stringify(theme, null, 2)}\n`, { flag: 'wx' });
  return file;
}
