import { describe, expect, it } from 'vitest';

import { DEFAULT_LAYOUT, windowLayoutSchema } from './stores';

describe('windowLayoutSchema', () => {
  // @feature editor.split-n
  it('reads a layout saved before panes replaced `split` as not split', () => {
    const old = { sidebar: true, split: 'renderer.js', consoleHeight: 160, sidebarWidth: 228, consoleVisible: true };
    const parsed = windowLayoutSchema.parse(old);
    expect(parsed.panes).toEqual([]);
    expect(parsed).not.toHaveProperty('split');
    expect(parsed).toEqual({ ...DEFAULT_LAYOUT });
  });

  it('keeps the panes it is given', () => {
    expect(windowLayoutSchema.parse({ ...DEFAULT_LAYOUT, panes: ['main.js', 'renderer.js'] }).panes).toEqual([
      'main.js',
      'renderer.js',
    ]);
  });
});
