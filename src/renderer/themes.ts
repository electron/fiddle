import {
  FiddleTheme,
  LoadedFiddleTheme,
  defaultDark,
} from '../themes-defaults';

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
  const theme =
    (await window.ElectronFiddle.readThemeFile(name || undefined)) ||
    defaultDark;

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

  Object.keys(theme.common).forEach((key: keyof typeof theme.common) => {
    cssContent += `    --${key}: ${theme.common[key]};\n`;
  });

  return `\n  html, body {\n${cssContent}  }\n`;
}
