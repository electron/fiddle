/**
 * Applies the appearance (REQUIREMENTS §17.12): following the system (the
 * default) leaves `data-theme` off so the tokens' media queries decide;
 * otherwise `data-theme` is `light` or `dark`. A custom theme sets its own
 * light/dark mode and its `common` tokens as CSS variables.
 */
import { useEffect, useLayoutEffect } from 'react';

import type { Settings, ThemeData } from '../../shared/settings';
import { applyEditorTheme } from '../editor/monaco';

let customProperties: string[] = [];

export function applyAppearance(
  root: HTMLElement,
  appearance: Settings['appearance'],
  custom?: Pick<ThemeData, 'isDark' | 'common'> | null,
): void {
  for (const property of customProperties) root.style.removeProperty(property);
  customProperties = [];
  if (custom) {
    root.dataset.theme = custom.isDark ? 'dark' : 'light';
    for (const [name, value] of Object.entries(custom.common)) {
      const property = name.startsWith('--') ? name : `--lu-${name}`;
      root.style.setProperty(property, value);
      customProperties.push(property);
    }
  } else if (appearance === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = appearance;
  }
}

/** Keeps `<html>` and Monaco's theme in step with the settings and the OS. */
export function useAppearance(
  appearance: Settings['appearance'],
  custom?: Pick<ThemeData, 'isDark' | 'common' | 'editor'> | null,
): void {
  useLayoutEffect(() => {
    applyAppearance(document.documentElement, appearance, custom);
    applyEditorTheme(custom?.editor);
  }, [appearance, custom]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyEditorTheme(custom?.editor);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [custom]);
}
