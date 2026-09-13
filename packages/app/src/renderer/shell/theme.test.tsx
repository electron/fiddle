import { describe, expect, it, vi } from 'vitest';

vi.mock('../editor/monaco', () => ({ applyEditorTheme: vi.fn() }));

const { applyAppearance } = await import('./theme');

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
    applyAppearance(root, 'system', { isDark: false, common: { surface: '#ffffff', '--lu-ink': '#000000' } });
    expect(root.dataset.theme).toBe('light');
    expect(root.style.getPropertyValue('--lu-surface')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--lu-ink')).toBe('#000000');
    applyAppearance(root, 'system');
    expect(root.style.getPropertyValue('--lu-surface')).toBe('');
    expect(root.dataset.theme).toBeUndefined();
  });
});
