import * as fsType from 'fs-extra';
import * as path from 'path';

import { CONFIG_PATH } from '../constants';
import { fancyImport } from '../utils/import';
import { defaultDark, DefaultThemes, FiddleTheme } from './themes-defaults';

/**
 * Returns a Fiddle theme, either a default one or by checking
 * the disk for a JSON file.
 *
 * @export
 * @param {string} [name]
 * @returns {Promise<FiddleTheme>}
 */
export async function getTheme(name?: string): Promise<FiddleTheme> {
  let theme = !name || name === DefaultThemes.DARK
    ? defaultDark
    : defaultDark;
  let cssContent = '';

  if (name) {
    const fs = await fancyImport<typeof fsType>('fs-extra');
    const themePath = path.join(CONFIG_PATH, 'themes', `${name}.json`);

    try {
      theme = await fs.readJSON(themePath);
    } catch (error) {
      console.warn(`Themes: Loading theme ${name} failed`, error);
    }
  }

  Object.keys(theme.common).forEach((key) => {
    cssContent += `  --${key}: ${theme.common[key]};\n`;
  });

  return {
    ...theme,
    css: `html, body {\n${cssContent}\n}`
  } as any;
}
