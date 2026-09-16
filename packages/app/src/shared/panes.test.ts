import { describe, expect, it } from 'vitest';

import { closePane, dropOnPane, followActiveFile, MAX_PANES, neighbourOf, shownPanes, storedPanes } from './panes';

const visible = ['main.js', 'preload.js', 'renderer.js', 'index.html', 'styles.css'];

// @feature editor.split-n
describe('shownPanes', () => {
  it('shows the active file alone when the editor is not split', () => {
    expect(shownPanes([], visible, 'main.js')).toEqual(['main.js']);
    expect(shownPanes(['renderer.js'], visible, 'main.js')).toEqual(['main.js']);
    expect(shownPanes([], visible, null)).toEqual([]);
  });

  it('keeps the stored panes that are visible files, once each, up to the limit', () => {
    expect(shownPanes(['main.js', 'renderer.js'], visible, 'renderer.js')).toEqual(['main.js', 'renderer.js']);
    expect(shownPanes(['main.js', 'gone.js', 'renderer.js', 'main.js'], visible, 'main.js')).toEqual([
      'main.js',
      'renderer.js',
    ]);
    // One pane left after dropping unknown names: not split, so the active file shows.
    expect(shownPanes(['gone.js', 'renderer.js'], visible, 'main.js')).toEqual(['main.js']);
    const six = [...visible, 'extra.js'];
    expect(shownPanes(six, six, 'main.js')).toHaveLength(MAX_PANES);
  });

  it('puts the active file in the first pane when a stale layout does not show it', () => {
    expect(shownPanes(['preload.js', 'renderer.js'], visible, 'main.js')).toEqual(['main.js', 'renderer.js']);
  });
});

// @feature editor.split-n
describe('followActiveFile', () => {
  it('leaves an unsplit layout alone', () => {
    const panes: string[] = [];
    expect(followActiveFile(panes, 'main.js', 'renderer.js', visible)).toBe(panes);
  });

  it('moves focus to a file that already has a pane without touching the panes', () => {
    const panes = ['main.js', 'renderer.js'];
    expect(followActiveFile(panes, 'main.js', 'renderer.js', visible)).toBe(panes);
  });

  it('shows a newly focused file in the focused pane', () => {
    expect(followActiveFile(['main.js', 'renderer.js'], 'renderer.js', 'index.html', visible)).toEqual([
      'main.js',
      'index.html',
    ]);
    expect(followActiveFile(['main.js', 'renderer.js', 'styles.css'], 'main.js', 'preload.js', visible)).toEqual([
      'preload.js',
      'renderer.js',
      'styles.css',
    ]);
  });

  it('drops panes whose file was hidden or removed, and unsplits below two', () => {
    const hidden = visible.filter((name) => name !== 'renderer.js');
    expect(followActiveFile(['main.js', 'renderer.js', 'styles.css'], 'main.js', 'main.js', hidden)).toEqual([
      'main.js',
      'styles.css',
    ]);
    expect(followActiveFile(['main.js', 'renderer.js'], 'main.js', 'main.js', hidden)).toEqual([]);
    // The focused pane's file was hidden and focus went to a file already showing: its pane closes.
    expect(followActiveFile(['main.js', 'renderer.js', 'styles.css'], 'renderer.js', 'main.js', hidden)).toEqual([
      'main.js',
      'styles.css',
    ]);
  });
});

// @feature editor.tabs editor.split-n
describe('dropOnPane', () => {
  const panes = ['main.js', 'renderer.js'];

  it('shows the file in the pane it was dropped in', () => {
    expect(dropOnPane(panes, 'index.html', 1, 'center')).toEqual(['main.js', 'index.html']);
    expect(dropOnPane(['main.js'], 'index.html', 0, 'center')).toEqual(['index.html']);
  });

  it('opens a new pane on the edge it was dropped on', () => {
    expect(dropOnPane(panes, 'index.html', 0, 'before')).toEqual(['index.html', 'main.js', 'renderer.js']);
    expect(dropOnPane(panes, 'index.html', 0, 'after')).toEqual(['main.js', 'index.html', 'renderer.js']);
    expect(dropOnPane(panes, 'index.html', 1, 'after')).toEqual(['main.js', 'renderer.js', 'index.html']);
    expect(dropOnPane(['main.js'], 'index.html', 0, 'after')).toEqual(['main.js', 'index.html']);
  });

  it('moves a file that is already showing, closing its old pane', () => {
    expect(dropOnPane(panes, 'main.js', 1, 'after')).toEqual(['renderer.js', 'main.js']);
    expect(dropOnPane(panes, 'renderer.js', 0, 'center')).toEqual(['renderer.js']);
    expect(dropOnPane(['main.js', 'renderer.js', 'index.html'], 'index.html', 0, 'after')).toEqual([
      'main.js',
      'index.html',
      'renderer.js',
    ]);
  });

  it('leaves the panes alone when a file is dropped on its own pane', () => {
    expect(dropOnPane(panes, 'main.js', 0, 'after')).toEqual(panes);
    expect(dropOnPane(panes, 'main.js', 5, 'center')).toEqual(panes);
  });
});

describe('closePane, neighbourOf and storedPanes', () => {
  it('closes a pane and picks the neighbour that takes focus', () => {
    const panes = ['main.js', 'renderer.js', 'index.html'];
    expect(closePane(panes, 'renderer.js')).toEqual(['main.js', 'index.html']);
    expect(neighbourOf(panes, 'renderer.js')).toBe('index.html');
    expect(neighbourOf(panes, 'index.html')).toBe('renderer.js');
    expect(neighbourOf(['main.js'], 'main.js')).toBeNull();
    expect(neighbourOf(panes, 'nope.js')).toBeNull();
  });

  it('stores fewer than two panes as not split', () => {
    expect(storedPanes(['main.js'])).toEqual([]);
    expect(storedPanes([])).toEqual([]);
    expect(storedPanes(['main.js', 'renderer.js'])).toEqual(['main.js', 'renderer.js']);
  });
});
