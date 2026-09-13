/**
 * The Lucent editor theme, built at runtime from the `--lu-*` tokens, so
 * Monaco follows the appearance (and imported themes' `common` tokens).
 */
import type { editor } from 'monaco-editor';

/** Tokens the editor theme reads. */
export const EDITOR_TOKENS = [
  'surface',
  'surface-raised',
  'ink',
  'ink-muted',
  'ink-faint',
  'accent',
  'accent-soft',
  'spark',
  'warning',
  'line',
  'line-strong',
  'fill',
  'fill-strong',
  'cursor-line',
  'syntax-keyword',
  'syntax-string',
  'syntax-function',
  'syntax-number',
  'syntax-comment',
] as const;
export type EditorToken = (typeof EDITOR_TOKENS)[number];
export type EditorTokens = Record<EditorToken, string>;

export const LUCENT_THEME = 'lucent';

/** Monaco wants #rrggbb or #rrggbbaa without the leading '#' in rules. */
const bare = (hex: string) => hex.replace(/^#/, '');

export function buildLucentTheme(
  tokens: EditorTokens,
  isDark: boolean,
): editor.IStandaloneThemeData {
  const rule = (token: string, color: string, fontStyle?: string) => ({
    token,
    foreground: bare(color),
    ...(fontStyle ? { fontStyle } : {}),
  });
  return {
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      rule('', tokens.ink),
      rule('keyword', tokens['syntax-keyword']),
      rule('string', tokens['syntax-string']),
      rule('string.escape', tokens['syntax-string']),
      rule('regexp', tokens['syntax-string']),
      rule('number', tokens['syntax-number']),
      rule('comment', tokens['syntax-comment']),
      rule('type', tokens['syntax-function']),
      rule('type.identifier', tokens['syntax-function']),
      rule('identifier', tokens.ink),
      rule('delimiter', tokens.ink),
      // HTML and CSS
      rule('tag', tokens['syntax-keyword']),
      rule('metatag', tokens['syntax-keyword']),
      rule('attribute.name', tokens['syntax-function']),
      rule('attribute.value', tokens['syntax-string']),
      rule('attribute.value.number', tokens['syntax-number']),
      rule('attribute.value.unit', tokens['syntax-number']),
      // JSON
      rule('string.key.json', tokens['syntax-function']),
      rule('string.value.json', tokens['syntax-string']),
    ],
    colors: {
      'editor.background': tokens.surface,
      'editor.foreground': tokens.ink,
      'editorLineNumber.foreground': tokens['ink-faint'],
      'editorLineNumber.activeForeground': tokens.ink,
      'editor.lineHighlightBackground': tokens['cursor-line'],
      'editor.lineHighlightBorder': '#00000000',
      'editorCursor.foreground': tokens.accent,
      'editor.selectionBackground': tokens['accent-soft'],
      'editor.inactiveSelectionBackground': tokens.fill,
      'editorIndentGuide.background1': tokens.line,
      'editorIndentGuide.activeBackground1': tokens['line-strong'],
      'editorWhitespace.foreground': tokens.line,
      'editorError.foreground': tokens.spark,
      'editorWarning.foreground': tokens.warning,
      'editorWidget.background': tokens['surface-raised'],
      'editorWidget.border': tokens.line,
      'editorSuggestWidget.background': tokens['surface-raised'],
      'editorSuggestWidget.selectedBackground': tokens['fill-strong'],
      'editorHoverWidget.background': tokens['surface-raised'],
      'editorGutter.background': tokens.surface,
      'scrollbarSlider.background': tokens.fill,
      'scrollbarSlider.hoverBackground': tokens['fill-strong'],
      'scrollbarSlider.activeBackground': tokens['fill-strong'],
      'focusBorder': '#00000000',
    },
  };
}

function hex2(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
}

/**
 * Converts a computed CSS colour (`rgb()`, `rgba()` or `color(srgb …)`, which
 * is what Chromium reports for `color-mix`) to `#rrggbb` or `#rrggbbaa`.
 * Returns undefined for anything else.
 */
export function cssColorToHex(value: string): string | undefined {
  const text = value.trim();
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text)) return text.toLowerCase();
  let channels: number[] | undefined;
  let alpha = 1;
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  const srgb = /^color\(srgb\s+([^)]+)\)$/i.exec(text);
  if (rgb?.[1]) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    channels = parts.slice(0, 3);
    if (parts[3] !== undefined) alpha = parts[3];
  } else if (srgb?.[1]) {
    const parts = srgb[1].split(/[\s/]+/).filter(Boolean).map(Number);
    channels = parts.slice(0, 3).map((c) => c * 255);
    if (parts[3] !== undefined) alpha = parts[3];
  }
  if (!channels || channels.length !== 3 || channels.some(Number.isNaN) || Number.isNaN(alpha))
    return undefined;
  const base = `#${channels.map(hex2).join('')}`;
  return alpha >= 1 ? base : `${base}${hex2(alpha * 255)}`;
}

/** Resolves each token through a probe element, so `color-mix()` and `var()` are computed. */
export function readEditorTokens(root: HTMLElement = document.documentElement): EditorTokens {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  root.appendChild(probe);
  try {
    const tokens = {} as EditorTokens;
    for (const token of EDITOR_TOKENS) {
      probe.style.color = `var(--lu-${token})`;
      tokens[token] = cssColorToHex(getComputedStyle(probe).color) ?? '#000000';
    }
    return tokens;
  } finally {
    probe.remove();
  }
}
