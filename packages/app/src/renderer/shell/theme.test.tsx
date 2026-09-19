import { describe, expect, it, vi } from 'vitest';

vi.mock('../editor/monaco', () => ({ applyEditorTheme: vi.fn() }));

const { EDITOR_TOKENS } = await import('../editor/theme');
const { applyAppearance, highContrastFor } = await import('./theme');
const { currentThemeSnapshot } = await import('./theme-snapshot');

describe('high contrast', () => {
  it('comes from a built-in high-contrast theme, or from the OS for Lucent only', () => {
    expect(highContrastFor('lucent-hc-dark', false)).toEqual({ mode: 'dark' });
    expect(highContrastFor('lucent-hc-light', true)).toEqual({ mode: 'light' });
    expect(highContrastFor('lucent', true)).toEqual({});
    expect(highContrastFor('lucent', false)).toBeUndefined();
    expect(highContrastFor('night', true)).toBeUndefined();
  });

  it('sets data-contrast, and a high-contrast theme fixes light or dark', () => {
    const root = document.createElement('html');
    applyAppearance(root, 'light', null, { mode: 'dark' });
    expect(root.dataset).toMatchObject({ contrast: 'high', theme: 'dark' });
    applyAppearance(root, 'system', null, {});
    expect(root.dataset.contrast).toBe('high');
    expect(root.dataset.theme).toBeUndefined();
    applyAppearance(root, 'system');
    expect(root.dataset.contrast).toBeUndefined();
  });

  it('snapshots Lucent with a high-contrast Monaco base', () => {
    const root = document.documentElement;
    root.dataset.theme = 'dark';
    root.dataset.contrast = 'high';
    const snapshot = currentThemeSnapshot(root);
    expect(snapshot).toMatchObject({ isDark: true, editor: { base: 'hc-black' } });
    expect(Object.keys(snapshot.common)).toEqual([...EDITOR_TOKENS]);
    root.dataset.theme = 'light';
    expect(currentThemeSnapshot(root).editor.base).toBe('hc-light');
    delete root.dataset.contrast;
    expect(currentThemeSnapshot(root).editor.base).toBe('vs');
    delete root.dataset.theme;
  });
});

describe('applyAppearance', () => {
  it('leaves data-theme off when following the system', () => {
    const root = document.createElement('html');
    root.dataset.theme = 'dark';
    applyAppearance(root, 'system');
    expect(root.dataset.theme).toBeUndefined();
  });

  it('sets data-theme for a fixed appearance', () => {
    const root = document.createElement('html');
    applyAppearance(root, 'light');
    expect(root.dataset.theme).toBe('light');
    applyAppearance(root, 'dark');
    expect(root.dataset.theme).toBe('dark');
  });

  it('applies a custom theme and removes its tokens again', () => {
    const root = document.createElement('html');
    applyAppearance(root, 'system', {
      isDark: false,
      common: { surface: '#ffffff', '--lu-ink': '#000000' },
    });
    expect(root.dataset.theme).toBe('light');
    expect(root.style.getPropertyValue('--lu-surface')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--lu-ink')).toBe('#000000');
    applyAppearance(root, 'system');
    expect(root.style.getPropertyValue('--lu-surface')).toBe('');
    expect(root.dataset.theme).toBeUndefined();
  });
});
