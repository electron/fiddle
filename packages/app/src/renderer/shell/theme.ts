import { useEffect, useLayoutEffect, useState } from 'react';

import {
  BUILTIN_THEME,
  HIGH_CONTRAST_THEMES,
  type Settings,
  type ThemeData,
} from '../../shared/settings';
import { settingsApi } from '../../ipc/renderer';
import { applyEditorTheme } from '../editor/monaco';
import { log } from '../features/about/log';
import { useAppState } from '../state';
import { currentThemeSnapshot } from './theme-snapshot';

let customProperties: string[] = [];

/** High contrast: a built-in high-contrast theme fixes light or dark; OS high contrast keeps the appearance. */
export interface HighContrast {
  mode?: 'light' | 'dark';
}

/** Whether to draw high contrast. OS high contrast applies to Lucent, never to a custom theme. */
export function highContrastFor(
  themeId: string,
  osHighContrast: boolean,
): HighContrast | undefined {
  if (themeId === HIGH_CONTRAST_THEMES.dark) return { mode: 'dark' };
  if (themeId === HIGH_CONTRAST_THEMES.light) return { mode: 'light' };
  return osHighContrast && themeId === BUILTIN_THEME ? {} : undefined;
}

export function applyAppearance(
  root: HTMLElement,
  appearance: Settings['appearance'],
  custom?: Pick<ThemeData, 'isDark' | 'common'> | null,
  contrast?: HighContrast,
): void {
  for (const property of customProperties) root.style.removeProperty(property);
  customProperties = [];
  if (contrast) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
  if (custom) {
    root.dataset.theme = custom.isDark ? 'dark' : 'light';
    for (const [name, value] of Object.entries(custom.common)) {
      const property = name.startsWith('--') ? name : `--lu-${name}`;
      root.style.setProperty(property, value);
      customProperties.push(property);
    }
  } else if (contrast?.mode) {
    root.dataset.theme = contrast.mode;
  } else if (appearance === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = appearance;
  }
}

function applyEditor(custom?: Pick<ThemeData, 'editor'> | null): void {
  if (custom) applyEditorTheme(custom.editor);
  else if (document.documentElement.dataset.contrast === 'high')
    applyEditorTheme(currentThemeSnapshot().editor);
  else applyEditorTheme();
}

/** Keeps `<html>` and Monaco's theme in step with the settings, the chosen theme's file, OS high contrast and the OS appearance. */
export function useAppearance(): void {
  const app = useAppState();
  const appearance = app?.settings.appearance ?? 'system';
  const themeId = app?.settings.theme ?? BUILTIN_THEME;
  const osHighContrast = app?.highContrast ?? false;

  const [loaded, setLoaded] = useState<{ id: string; data: ThemeData | null } | null>(null);
  useEffect(() => {
    if (themeId === BUILTIN_THEME) return;
    let current = true;
    settingsApi.GetTheme(themeId).then(
      (data) => {
        if (current) setLoaded({ id: themeId, data: data ?? null });
      },
      (error: unknown) => log.error('loading the theme failed', themeId, error),
    );
    return () => {
      current = false;
    };
  }, [themeId]);
  const custom = loaded?.id === themeId ? loaded.data : null;

  useLayoutEffect(() => {
    const root = document.documentElement;
    applyAppearance(root, appearance, custom, highContrastFor(themeId, osHighContrast));
    applyEditor(custom);
  }, [appearance, custom, themeId, osHighContrast]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyEditor(custom);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [custom]);
}
