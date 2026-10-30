import { describe, expect, it } from 'vitest';

import { DEFAULT_LAYOUT, windowLayoutSchema } from './stores';

describe('windowLayoutSchema', () => {
  it('reads a layout without panes as not split', () => {
    const { sidebar, consoleHeight, sidebarWidth } = DEFAULT_LAYOUT;
    expect(
      windowLayoutSchema.parse({ sidebar, consoleHeight, sidebarWidth }).panes,
    ).toEqual([]);
  });

  it('keeps the panes it is given', () => {
    expect(
      windowLayoutSchema.parse({ ...DEFAULT_LAYOUT, panes: ['main.js', 'renderer.js'] })
        .panes,
    ).toEqual(['main.js', 'renderer.js']);
  });
});
