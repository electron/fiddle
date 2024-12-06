import { PREFERS_DARK_MEDIA_QUERY } from './constants';
import { AppState } from './state';
import {
  DefaultThemes,
  FiddleTheme,
  LoadedFiddleTheme,
  defaultDark,
  defaultLight,
} from '../themes-defaults';

/**
 * Activate a given theme (or the default)
 */
export function activateTheme(theme: LoadedFiddleTheme) {
  const { monaco } = window;
  monaco.editor.defineTheme('main', theme.editor as any);
  monaco.editor.setTheme('main');
}

export function getCurrentTheme(): LoadedFiddleTheme {
  return window.matchMedia(PREFERS_DARK_MEDIA_QUERY).matches
    ? defaultDark
    : defaultLight;
}

/**
 * Returns a Fiddle theme, either a default one or by checking
 * the disk for a JSON file.
 */
export async function getTheme(
  appState: AppState,
  name: string | null,
): Promise<LoadedFiddleTheme> {
  console.log(`Themes: getTheme() loading ${name || 'default'}`);

  let theme: LoadedFiddleTheme | null = null;

  if (name === DefaultThemes.LIGHT) {
    theme = defaultLight;
  } else if (name === DefaultThemes.DARK) {
    theme = defaultDark;
  } else if (name) {
    theme = await window.ElectronFiddle.readThemeFile(name);
  }

  // If there is no theme, default to the current system theme
  // if the app is using system theme, otherwise default to dark
  if (!theme) {
    theme = appState.isUsingSystemTheme ? getCurrentTheme() : defaultDark;
  }

  return { ...theme, css: await getCssStringForTheme(theme) };
}

/**
 * Get the CSS string for a theme.
 */
async function getCssStringForTheme(theme: FiddleTheme): Promise<string> {
  let cssContent = '';

  Object.keys(theme.common).forEach((key: keyof typeof theme.common) => {
    cssContent += `    --${key}: ${theme.common[key]};\n`;
  });

  return `\n  html, body {\n${cssContent}  }\n`;
}
