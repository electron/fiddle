/** Tests the appearance: `<html>`'s theme and contrast attributes, custom theme tokens, and the Monaco theme that goes with them. */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Settings, ThemeData } from '../../shared/settings';
import type { AppState } from '../../shared/stores';

const mocks = vi.hoisted(() => ({
  applyEditorTheme: vi.fn((_theme?: unknown) => undefined),
  app: undefined as Partial<AppState> | undefined,
  /** The OS says dark; `change` listeners hear it flip. */
  media: { matches: true, listeners: new Set<() => void>() },
}));

vi.mock('../editor/monaco', () => ({ applyEditorTheme: mocks.applyEditorTheme }));
vi.mock('../state', () => ({ useAppState: () => mocks.app }));
vi.stubGlobal('matchMedia', () => ({
  get matches() {
    return mocks.media.matches;
  },
  addEventListener: (_type: string, listener: () => void) =>
    mocks.media.listeners.add(listener),
  removeEventListener: (_type: string, listener: () => void) =>
    mocks.media.listeners.delete(listener),
}));

const { EDITOR_TOKENS } = await import('../editor/theme');
const { applyAppearance, highContrastFor, useAppearance } = await import('./theme');
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

describe('useAppearance', () => {
  type Custom = Pick<ThemeData, 'isDark' | 'common' | 'editor'>;
  function Probe({
    appearance,
    custom,
  }: {
    appearance: Settings['appearance'];
    custom?: Custom | null;
  }) {
    useAppearance(appearance, custom);
    return null;
  }
  const appWith = (theme: string, highContrast = false) =>
    ({ settings: { theme } as Settings, highContrast }) as Partial<AppState>;
  const root = document.documentElement;
  const lastEditorTheme = () => mocks.applyEditorTheme.mock.calls.at(-1)?.[0];

  afterEach(() => {
    delete root.dataset.theme;
    delete root.dataset.contrast;
    mocks.app = undefined;
    mocks.media.matches = true;
    vi.clearAllMocks();
  });

  it('sets a fixed appearance on <html> and gives Monaco the stock Lucent theme', () => {
    mocks.app = appWith('lucent');
    render(<Probe appearance="dark" />);
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.contrast).toBeUndefined();
    expect(mocks.applyEditorTheme).toHaveBeenCalledWith();
  });

  it('hands a custom theme to <html> and to Monaco, and takes it away again', () => {
    mocks.app = appWith('night');
    const custom: Custom = {
      isDark: true,
      common: { surface: '#101010' },
      editor: { base: 'vs-dark', inherit: true, rules: [], colors: {} },
    };
    const view = render(<Probe appearance="light" custom={custom} />);
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.getPropertyValue('--lu-surface')).toBe('#101010');
    expect(lastEditorTheme()).toBe(custom.editor);
    view.rerender(<Probe appearance="light" custom={null} />);
    expect(root.dataset.theme).toBe('light');
    expect(root.style.getPropertyValue('--lu-surface')).toBe('');
    expect(mocks.applyEditorTheme).toHaveBeenLastCalledWith();
  });

  it('draws OS high contrast for Lucent with a high-contrast Monaco base that follows the OS appearance', () => {
    mocks.app = appWith('lucent', true);
    render(<Probe appearance="system" />);
    expect(root.dataset.contrast).toBe('high');
    expect(root.dataset.theme).toBeUndefined();
    expect(lastEditorTheme()).toMatchObject({ base: 'hc-black' });
    // The OS turns light: Monaco follows without a settings change.
    mocks.media.matches = false;
    act(() => mocks.media.listeners.forEach((listener) => listener()));
    expect(lastEditorTheme()).toMatchObject({ base: 'hc-light' });
  });

  it('lets a built-in high-contrast theme fix light or dark over the appearance setting', () => {
    mocks.app = appWith('lucent-hc-light');
    const view = render(<Probe appearance="dark" />);
    expect(root.dataset).toMatchObject({ theme: 'light', contrast: 'high' });
    expect(lastEditorTheme()).toMatchObject({ base: 'hc-light' });
    mocks.app = appWith('lucent-hc-dark');
    view.rerender(<Probe appearance="light" />);
    expect(root.dataset).toMatchObject({ theme: 'dark', contrast: 'high' });
    expect(lastEditorTheme()).toMatchObject({ base: 'hc-black' });
  });

  it('stops listening to the OS appearance when unmounted', () => {
    mocks.app = appWith('lucent');
    const view = render(<Probe appearance="system" />);
    expect(mocks.media.listeners.size).toBe(1);
    view.unmount();
    expect(mocks.media.listeners.size).toBe(0);
  });
});
