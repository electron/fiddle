import * as path from 'path';

import { shell } from 'electron';
import * as fs from 'fs-extra';
import * as namor from 'namor';

import { CONFIG_PATH } from './constants';
import {
  DefaultThemes,
  FiddleTheme,
  LoadedFiddleTheme,
  defaultDark,
  defaultLight,
} from './themes-defaults';

export const THEMES_PATH = path.join(CONFIG_PATH, 'themes');

/**
 * Activate a given theme (or the default)
 *
 * @param {LoadedFiddleTheme} theme
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
 * @returns {Promise<FiddleTheme | null>}
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
 * Create theme file and show in folder.
 *
 * @param {FiddleTheme} theme
 * @param {string} [name]
 * @returns {Promise<LoadedFiddleTheme>}
 */
export async function createThemeFile(
  theme: FiddleTheme | LoadedFiddleTheme,
  name?: string,
): Promise<LoadedFiddleTheme> {
  // Filter out file and css keys if they exist
  theme = Object.fromEntries(
    Object.entries(theme).filter(([key]) => !['file', 'css'].includes(key)),
  ) as FiddleTheme;

  if (!name) {
    name = namor.generate({ words: 2, numbers: 0 });
  }

  const file = name.endsWith('.json') ? name : `${name}.json`;
  const themePath = path.join(THEMES_PATH, file);

  await fs.outputJSON(
    themePath,
    {
      ...theme,
      name,
    },
    { spaces: 2 },
  );

  shell.showItemInFolder(themePath);

  return {
    ...theme,
    name,
    file,
  };
}

/**
 * Reads and then returns all available themes.
 *
 * @returns {Promise<Array<LoadedFiddleTheme>>}
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
      if (!file.endsWith('.json')) {
        continue;
      }

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
 * @returns {Promise<LoadedFiddleTheme>}
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
 * @returns {Promise<string>}
 */
async function getCssStringForTheme(theme: FiddleTheme): Promise<string> {
  let cssContent = '';

  Object.keys(theme.common).forEach((key) => {
    cssContent += `    --${key}: ${theme.common[key]};\n`;
  });

  return `\n  html, body {\n${cssContent}  }\n`;
}
