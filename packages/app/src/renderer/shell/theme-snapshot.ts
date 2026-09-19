// The built-in theme as drawn now: Monaco theme and token values read from the rendered tokens, with a
// high-contrast base under `data-contrast="high"`. Doesn't load Monaco.
import type { ThemeSnapshot } from '../../shared/settings';
import { buildLucentTheme, readEditorTokens } from '../editor/theme';

export function currentThemeSnapshot(
  root: HTMLElement = document.documentElement,
): ThemeSnapshot {
  const { theme, contrast } = root.dataset;
  const isDark = theme
    ? theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const tokens = readEditorTokens(root);
  const editor = buildLucentTheme(tokens, isDark);
  if (contrast === 'high') editor.base = isDark ? 'hc-black' : 'hc-light';
  return { isDark, editor, common: { ...tokens } };
}
