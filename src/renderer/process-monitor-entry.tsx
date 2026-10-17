import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { getCssStringForTheme } from '../utils/theme';
import { defaultDark, defaultLight } from '../themes-defaults';
import { PREFERS_DARK_MEDIA_QUERY } from '../constants';
import { ProcessMonitor } from './components/process-monitor';
import '../less/root.less';

/**
 * Injects the Fiddle theme CSS variables into the #fiddle-theme style tag,
 * exactly mirroring how app.tsx does it in the main window.
 */
function applyThemeCss(css: string) {
  const tag = document.getElementById('fiddle-theme');
  if (tag) tag.innerHTML = css;
}

async function bootstrapTheme() {
  // Try to read the user's currently active theme from disk.
  const themePath: string = window.ElectronFiddle.themePath;
  let theme = null;

  if (themePath) {
    theme = await window.ElectronFiddle.readThemeFile(themePath);
  }

  // Fall back to the system preference if no custom theme is found.
  if (!theme) {
    theme = window.matchMedia(PREFERS_DARK_MEDIA_QUERY).matches
      ? defaultDark
      : defaultLight;
  }

  applyThemeCss(getCssStringForTheme(theme));
}

// Reload theme whenever the main window changes it.
window.ElectronFiddle.addEventListener('theme-loaded', ((theme: {
  common?: Record<string, string>;
}) => {
  if (theme && theme.common) {
    applyThemeCss(getCssStringForTheme(theme as any));
  }
}) as () => void);

bootstrapTheme();

const render = () => {
  ReactDOM.render(<ProcessMonitor />, document.getElementById('app'));
};

render();
