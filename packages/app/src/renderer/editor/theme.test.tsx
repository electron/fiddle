import { describe, expect, it } from 'vitest';

import {
  buildLucentTheme,
  cssColorToHex,
  EDITOR_TOKENS,
  type EditorTokens,
} from './theme';

describe('cssColorToHex', () => {
  it('converts computed colours', () => {
    expect(cssColorToHex('rgb(27, 28, 38)')).toBe('#1b1c26');
    expect(cssColorToHex('rgba(255, 110, 110, 0.5)')).toBe('#ff6e6e80');
    expect(cssColorToHex('rgb(255 255 255 / 0.08)')).toBe('#ffffff14');
    expect(cssColorToHex('color(srgb 0.106 0.11 0.149)')).toBe('#1b1c26');
    expect(cssColorToHex('color(srgb 1 0 0 / 0.5)')).toBe('#ff000080');
    expect(cssColorToHex('#9FEAF9')).toBe('#9feaf9');
  });

  it('rejects what it cannot read', () => {
    expect(cssColorToHex('')).toBeUndefined();
    expect(cssColorToHex('oklch(0.5 0.1 200)')).toBeUndefined();
    expect(cssColorToHex('rgb(nope)')).toBeUndefined();
  });
});

describe('buildLucentTheme', () => {
  const tokens = Object.fromEntries(
    EDITOR_TOKENS.map((t, i) => [t, `#0000${i.toString(16).padStart(2, '0')}`]),
  ) as EditorTokens;

  it('maps the syntax and editor colours from tokens', () => {
    const theme = buildLucentTheme(tokens, true);
    expect(theme.base).toBe('vs-dark');
    expect(theme.colors['editor.background']).toBe(tokens.surface);
    expect(theme.colors['editor.lineHighlightBackground']).toBe(tokens['cursor-line']);
    expect(theme.colors['editorLineNumber.foreground']).toBe(tokens['ink-faint']);
    expect(theme.rules.find((r) => r.token === 'keyword')?.foreground).toBe(
      tokens['syntax-keyword'].slice(1),
    );
    expect(buildLucentTheme(tokens, false).base).toBe('vs');
  });
});
