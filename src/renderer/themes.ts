import * as fsType from 'fs-extra';
import * as MonacoType from 'monaco-editor';
import * as path from 'path';

import { CONFIG_PATH } from '../constants';
import { fancyImport } from '../utils/import';
import { defaultDark, defaultLight, DefaultThemes, FiddleTheme, LoadedFiddleTheme } from './themes-defaults';

export const THEMES_PATH = path.join(CONFIG_PATH, 'themes');


/**
 * Activate a given theme (or the default)
 *
 * @param {typeof MonacoType} [monaco]
 * @param {LoadedFiddleTheme} [theme]
 */
export async function activateTheme(
  monaco?: typeof MonacoType, theme?: LoadedFiddleTheme, name?: string | null
) {
  const _monaco = monaco || window.ElectronFiddle.app.monaco;
  const _theme = theme || await getTheme(name);

  if (!_monaco) return;

  _monaco.editor.defineTheme('main', _theme.editor as any);
  _monaco.editor.setTheme('main');
}


/**
 * Read in a theme file.
 *
 * @export
 * @param {string} [name]
 * @returns {Promise<FiddleTheme>}
 */
export async function readThemeFile(name?: string): Promise<FiddleTheme | null> {
  if (!name || name === DefaultThemes.DARK) return defaultDark as any;
  if (name === DefaultThemes.LIGHT) return defaultLight as any;

  const fs = await fancyImport<typeof fsType>('fs-extra');
  const themePath = name.endsWith('.json')
    ? path.join(THEMES_PATH, name)
    : path.join(THEMES_PATH, `${name}.json`);

  try {
    return await fs.readJSON(themePath);
  } catch (error) {
    console.warn(`Themes: Loading theme ${name} failed`, error);
    return null;
  }
}


/**
 * Reads and then returns all available themes.
 *
 * @returns {Promise<Array<FiddleTheme>>}
 */
export async function getAvailableThemes(): Promise<Array<LoadedFiddleTheme>> {
  const fs = await fancyImport<typeof fsType>('fs-extra');
  const themes: Array<LoadedFiddleTheme> = [
    defaultDark as any,
    defaultLight as any
  ];

  if (!fs.existsSync(THEMES_PATH)) {
    return themes;
  }

  try {
    const themeFiles = await fs.readdir(THEMES_PATH);

    for (const file of themeFiles) {
      const theme = await readThemeFile(name);

      if (theme) {
        themes.push({
          ...theme,
          name: theme.name || file.replace('.json', ''),
          file
        });
      }
    }
  } catch (error) {
    console.warn(`Themes: Could not read available themes`, error);
  }

  return themes;
}

/**
 * Returns a Fiddle theme, either a default one or by checking
 * the disk for a JSON file.
 *
 * @export
 * @param {string} [name]
 * @returns {Promise<FiddleTheme>}
 */
export async function getTheme(name?: string | null): Promise<FiddleTheme> {
  let cssContent = '';

  console.log(`Themes: getTheme() loading ${name || 'default'}`);
  const theme = await readThemeFile(name || undefined) || defaultDark;

  Object.keys(theme.common).forEach((key) => {
    cssContent += `  --${key}: ${theme.common[key]};\n`;
  });

  return {
    ...theme,
    css: `html, body {\n${cssContent}\n}`
  } as any;
}
