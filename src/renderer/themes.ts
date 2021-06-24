import * as fs from 'fs-extra';
import * as path from 'path';

import { CONFIG_PATH } from './constants';
import {
  defaultDark,
  defaultLight,
  DefaultThemes,
  FiddleTheme,
  LoadedFiddleTheme,
} from './themes-defaults';

export const THEMES_PATH = path.join(CONFIG_PATH, 'themes');

/**
 * Activate a given theme (or the default)
 *
 * @param {typeof MonacoType} [monaco]
 * @param {LoadedFiddleTheme} [theme]
 */
export function activateTheme(theme: LoadedFiddleTheme) {
  const { monaco } = window.ElectronFiddle;
  monaco.editor.defineTheme('main', theme.editor as any);
  monaco.editor.setTheme('main');
}

/**
 * Read in a theme file.
 *
 * @export
 * @param {string} [name]
 * @returns {Promise<FiddleTheme>}
 */
export async function readThemeFile(
  name?: string,
): Promise<LoadedFiddleTheme | null> {
  if (!name || name === DefaultThemes.DARK) return defaultDark as any;
  if (name === DefaultThemes.LIGHT) return defaultLight as any;

  const file = name.endsWith('.json') ? name : `${name}.json`;
  const themePath = path.join(THEMES_PATH, file);

  try {
    const theme = await fs.readJSON(themePath);
    return {
      ...theme,
      name: theme.name || name.replace('.json', ''),
      file,
    };
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
  const themes: Array<LoadedFiddleTheme> = [
    defaultDark as any,
    defaultLight as any,
  ];

  if (!fs.existsSync(THEMES_PATH)) {
    return themes;
  }

  try {
    const themeFiles = await fs.readdir(THEMES_PATH);

    for (const file of themeFiles) {
      const theme = await readThemeFile(file);

      if (theme) {
        themes.push(theme);
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
export async function getTheme(
  name?: string | null,
): Promise<LoadedFiddleTheme> {
  console.log(`Themes: getTheme() loading ${name || 'default'}`);
  const theme = (await readThemeFile(name || undefined)) || defaultDark;

  return { ...theme, css: await getCssStringForTheme(theme) };
}

/**
 * Get the CSS string for a theme.
 *
 * @param {FiddleTheme} theme
 * @returns {string}
 */
async function getCssStringForTheme(theme: FiddleTheme): Promise<string> {
  let cssContent = '';

  Object.keys(theme.common).forEach((key) => {
    cssContent += `    --${key}: ${theme.common[key]};\n`;
  });

  return `\n  html, body {\n${cssContent}  }\n`;
}
