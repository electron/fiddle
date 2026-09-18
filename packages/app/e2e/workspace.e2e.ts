// The window's parts, panels, the split editor and multiple windows.
import { describe, expect, it } from 'vitest';

import { makeFolder, role, useApp, windowState } from './harness.ts';

describe('workspace', () => {
  const app = useApp();
  const layout = async () => (await windowState(app())).layout;

  it('shows the editor, console, files, packages and the toolbar controls', async () => {
    await app().query(role('code'));
    await app().query(role('region', 'Console'));
    await app().query(role('navigation', 'Files'));
    await app().query(role('region', 'Packages'));
    await app().query(role('group', 'Toolbar'));
    await app().query(role('button', /^Electron \d+\.\d+\.\d+/));
    await app().query(role('button', 'Run'));
    await app().query(role('button', 'Publish'));
  });

  it('opens one editor tab per visible file', async () => {
    const { fiddle } = await windowState(app());
    const tabs = (await app().query(role('tab'))).map((tab) => tab.name).sort();
    expect(tabs).toEqual(
      fiddle.files
        .filter((file) => file.visible)
        .map((file) => file.name)
        .sort(),
    );
  });

  it('splits the editor and closes the split', async () => {
    await app().click(role('button', 'Split editor'));
    // A second pane opens beside the focused one, showing renderer.js.
    await expect
      .poll(async () => (await layout()).panes)
      .toEqual(['main.js', 'renderer.js']);
    expect(await app().query(role('code'))).toHaveLength(2);
    await app().click(role('button', 'Close split', { nth: 0 }));
    await expect.poll(async () => (await layout()).panes).toEqual([]);
    expect(await app().query(role('code'))).toHaveLength(1);
  });

  // Synthetic drag and drop: the driver has no pointer drag, so these dispatch
  // the DragEvents a real drag produces, sharing one DataTransfer.

  const visibleTabs = async () =>
    (await windowState(app())).fiddle.files
      .filter((file) => file.visible)
      .map((file) => file.name);
  const activeFile = async () => (await windowState(app())).fiddle.activeFile;
  const panes = async () => (await layout()).panes;
  const tabNamed = (name: string) =>
    `[...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.startsWith(${JSON.stringify(name)}))`;
  /** Starts dragging `name`'s tab and waits until the sheet has taken note (drop zones are up). Leaves `tab` and `data` in scope. */
  const startDrag = (name: string) => `
    const tab = ${tabNamed(name)};
    const data = new DataTransfer();
    tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
    for (let i = 0; i < 100 && !document.querySelector('[data-tab-dragging]'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (!document.querySelector('[data-tab-dragging]')) throw new Error('The tab drag did not start');`;
  /** Drops `name`'s tab on a zone ('before', 'center' or 'after') of the pane at `index`. */
  const dragTabToPane = (
    name: string,
    index: number,
    zone: 'before' | 'center' | 'after',
  ) =>
    app().evaluate(`(async () => {
      ${startDrag(name)}
      const target = document.querySelector('[data-pane-index="${index}"] [data-drop-zone="${zone}"]');
      if (!target) throw new Error('No ${zone} drop zone on pane ${index}');
      for (const type of ['dragenter', 'dragover', 'drop'])
        target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }));
      tab.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: data }));
    })()`);
  /** Drops `name`'s tab on the near or far half of `onto`'s tab, or past the last tab (`onto` null). */
  const dragTabAlongRow = (
    name: string,
    onto: string | null,
    side: 'before' | 'after' = 'before',
  ) =>
    app().evaluate(`(async () => {
      ${startDrag(name)}
      const onto = ${onto === null ? 'null' : tabNamed(onto)};
      const row = tab.closest('[role="tablist"]').parentElement.parentElement;
      const rect = (onto ?? row).getBoundingClientRect();
      const rtl = getComputedStyle(row).direction === 'rtl';
      // The near (start) half of a tab is its left half, or its right half in a right-to-left layout.
      const left = onto ? (${JSON.stringify(side)} === 'before') !== rtl : rtl;
      const clientX = onto ? (left ? rect.left + 4 : rect.right - 4) : (left ? rect.left + 2 : rect.right - 2);
      const init = { bubbles: true, cancelable: true, dataTransfer: data, clientX, clientY: rect.top + rect.height / 2 };
      for (const type of ['dragenter', 'dragover', 'drop']) (onto ?? row).dispatchEvent(new DragEvent(type, init));
      tab.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: data }));
    })()`);
  /** The zones each pane offers while `name`'s tab is dragged, e.g. `['before center', '', 'center after']`; ends the drag. */
  const dropZonesWhileDragging = (name: string) =>
    app().evaluate(`(async () => {
      ${startDrag(name)}
      const zones = [...document.querySelectorAll('[data-pane-index]')].map((pane) =>
        [...pane.querySelectorAll('[data-drop-zone]')].map((zone) => zone.dataset.dropZone).join(' '));
      tab.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: data }));
      return zones;
    })()`);

  it('closes tabs and opens a dragged tab in a pane or beside it', async () => {
    // Delete closes the focused tab. The file stays in the sidebar, and clicking it there reopens the tab.
    await app().click(role('tab', /^main\.js\b/));
    await app().press('Delete', role('tab', /^main\.js\b/));
    await expect.poll(visibleTabs).not.toContain('main.js');
    await app().waitForAbsent(role('tab', /^main\.js\b/));
    await app().click(role('row', 'main.js'));
    await app().query(role('tab', /^main\.js\b/));
    await expect.poll(activeFile).toBe('main.js');

    // Dropping a tab on the far edge of the pane opens it in a second pane and focuses it.
    await dragTabToPane('renderer.js', 0, 'after');
    await expect.poll(panes).toEqual(['main.js', 'renderer.js']);
    await expect.poll(activeFile).toBe('renderer.js');
    await expect.poll(async () => (await app().query(role('code'))).length).toBe(2);
    // Clicking the other pane's tab moves focus there; the panes stay.
    await app().click(role('tab', /^main\.js\b/));
    await expect.poll(activeFile).toBe('main.js');
    expect(await panes()).toEqual(['main.js', 'renderer.js']);
    // Clicking a tab that no pane shows puts its file in the focused pane.
    await app().click(role('tab', /^index\.html\b/));
    await expect.poll(panes).toEqual(['index.html', 'renderer.js']);
    // Dropping a pane's file in the middle of the other pane shows it there and closes its own pane.
    await dragTabToPane('renderer.js', 0, 'center');
    await expect.poll(panes).toEqual([]);
    await expect.poll(activeFile).toBe('renderer.js');
    await expect.poll(async () => (await app().query(role('code'))).length).toBe(1);

    // The close glyph on a pane's tab closes the tab and its pane; focus moves to the neighbour.
    await dragTabToPane('main.js', 0, 'before');
    await expect.poll(panes).toEqual(['main.js', 'renderer.js']);
    await expect.poll(activeFile).toBe('main.js');
    await app().evaluate(
      `${tabNamed('main.js')}.querySelector('[data-tab-close]').click()`,
    );
    await expect.poll(panes).toEqual([]);
    await expect.poll(visibleTabs).not.toContain('main.js');
    expect(await activeFile()).toBe('renderer.js');
    await app().click(role('row', 'main.js'));
    await expect.poll(visibleTabs).toContain('main.js');
    await app().query(role('tab', /^main\.js\b/));
  });

  it('moves tabs by dragging them along the row, and with Move tab left and right', async () => {
    const before = await visibleTabs();
    expect(before.length).toBeGreaterThanOrEqual(3);
    const [first, second] = before as [string, string];
    const last = before.at(-1)!;
    const tabPattern = (name: string) => new RegExp(`^${name.replaceAll('.', '\\.')}\\b`);

    // Drag the last tab in front of the first.
    await dragTabAlongRow(last, first, 'before');
    await expect.poll(visibleTabs).toEqual([last, ...before.slice(0, -1)]);
    // The sidebar follows: within its group, the file moved too (main owns one order for both).
    expect(
      (await windowState(app())).fiddle.files.map((file) => file.name).indexOf(last),
    ).toBe(0);

    // Move tab right acts on the selected tab.
    await app().click(role('tab', tabPattern(last)));
    await expect.poll(activeFile).toBe(last);
    await app().runCommand('editor.moveTabRight');
    await expect.poll(visibleTabs).toEqual([first, last, ...before.slice(1, -1)]);
    // Ctrl+Shift+PageUp moves it back (Ctrl+Shift+PageDown the other way), as in VS Code; Ctrl+Cmd+Left and Right on macOS.
    const [moveLeft, moveRight] =
      process.platform === 'darwin'
        ? ['Ctrl+Cmd+Left', 'Ctrl+Cmd+Right']
        : ['Ctrl+Shift+PageUp', 'Ctrl+Shift+PageDown'];
    await app().press(moveLeft);
    await expect.poll(visibleTabs).toEqual([last, ...before.slice(0, -1)]);
    await app().press(moveRight);
    await app().press(moveRight);
    await expect.poll(visibleTabs).toEqual([first, second, last, ...before.slice(2, -1)]);

    // Dropping a tab past the last one moves it to the end; on a tab's far half, after that tab.
    await dragTabAlongRow(last, null);
    await expect.poll(visibleTabs).toEqual(before);
    await dragTabAlongRow(first, second, 'after');
    await expect.poll(visibleTabs).toEqual([second, first, ...before.slice(2)]);
    await app().click(role('tab', tabPattern(first)));
    await app().runCommand('editor.moveTabLeft');
    await expect.poll(visibleTabs).toEqual(before);
  });

  it('splits a split view: up to four panes side by side, each its own drop target', async () => {
    const files = await visibleTabs();
    expect(files.length).toBeGreaterThanOrEqual(4);
    const [a, b, c, d] = files as [string, string, string, string];
    await app().click(role('tab', new RegExp(`^${a.replaceAll('.', '\\.')}\\b`)));
    await expect.poll(activeFile).toBe(a);
    await expect.poll(panes).toEqual([]);

    // Each drop on a far edge adds a pane after that one; the dropped file takes focus.
    await dragTabToPane(b, 0, 'after');
    await expect.poll(panes).toEqual([a, b]);
    await dragTabToPane(c, 1, 'after');
    await expect.poll(panes).toEqual([a, b, c]);
    await expect.poll(activeFile).toBe(c);
    await expect.poll(async () => (await app().query(role('code'))).length).toBe(3);
    // A near edge opens the new pane before that one.
    await dragTabToPane(d, 0, 'before');
    await expect.poll(panes).toEqual([d, a, b, c]);
    await expect.poll(async () => (await app().query(role('code'))).length).toBe(4);

    // Four is the limit, and every file is showing, so a dragged tab can only move its pane:
    // a pane offers just the drops that change something, and the file's own pane none.
    expect(await dropZonesWhileDragging(a)).toEqual([
      'before center',
      '',
      'center after',
      'before center after',
    ]);
    await dragTabToPane(a, 3, 'after');
    await expect.poll(panes).toEqual([d, b, c, a]);
    await expect.poll(async () => (await app().query(role('code'))).length).toBe(4);
    // Dropped in another pane's middle, a showing file takes that pane over and its old pane closes.
    await dragTabToPane(d, 3, 'center');
    await expect.poll(panes).toEqual([b, c, d]);
    await expect.poll(activeFile).toBe(d);

    // Close pane closes one and keeps its tab; Maximize keeps only that pane.
    await app().click(role('button', 'Close pane', { nth: 0 }));
    await expect.poll(panes).toEqual([c, d]);
    expect(await visibleTabs()).toContain(b);
    await app().click(role('button', 'Maximize', { nth: 1 }));
    await expect.poll(panes).toEqual([]);
    await expect.poll(activeFile).toBe(d);

    // CmdOrCtrl+\\ (the Split editor button) splits once; while split, it keeps only the focused pane.
    await app().press('CmdOrCtrl+\\');
    await expect.poll(async () => (await panes()).length).toBe(2);
    await dragTabToPane(a, 1, 'after');
    await expect.poll(async () => (await panes()).length).toBe(3);
    await app().click(role('button', 'Close split'));
    await expect.poll(panes).toEqual([]);
    await expect.poll(async () => (await app().query(role('code'))).length).toBe(1);
  });

  it('hides and shows the sidebar and the console', async () => {
    await app().query(role('separator', 'Resize sidebar'));
    await app().query(role('separator', 'Resize console'));
    await app().click(role('button', 'Hide sidebar'));
    await app().waitForAbsent(role('navigation', 'Files'));
    expect((await layout()).sidebar).toBe(false);
    await app().click(role('button', 'Show sidebar'));
    await app().query(role('navigation', 'Files'));

    await app().runCommand('view.toggleConsole');
    await app().waitForAbsent(role('region', 'Console'));
    await app().runCommand('view.toggleConsole');
    await app().query(role('region', 'Console'));
  });

  it('routes undo, redo, select all and copy to the editor', async () => {
    const dirty = async () => (await windowState(app())).fiddle.dirty;
    const undoAll = async () => {
      for (let i = 0; i < 10 && (await dirty()); i++) await app().press('CmdOrCtrl+Z');
      await expect.poll(dirty).toBe(false);
    };
    await app().click(role('code'));
    await app().type('// typed');
    await expect.poll(dirty).toBe(true);
    await undoAll();
    await app().press('Shift+CmdOrCtrl+Z');
    await expect.poll(dirty).toBe(true);

    await app().press('CmdOrCtrl+A');
    await app().press('CmdOrCtrl+C');
    await expect.poll(() => app().clipboard()).toContain('electron');
    await app().click(role('code'));
    await undoAll();
  });

  it('shows the editor diagnostics on the file tab', async () => {
    await app().click(role('tab', /^renderer\.js\b/));
    await app().click(role('code'));
    await app().type('const = ;');
    await app().query(role('tab', /^renderer\.js , \d+ errors?\b/, { timeout: 10_000 }));
    for (let i = 0; i < 10 && (await windowState(app())).fiddle.dirty; i++)
      await app().press('CmdOrCtrl+Z');
    await expect.poll(async () => (await windowState(app())).fiddle.dirty).toBe(false);
    await app().query(role('tab', 'renderer.js', { timeout: 10_000 }));
  });

  it('focuses the window that already has a folder open', async () => {
    const dir = makeFolder(app(), 'shared', { 'main.js': '// shared\n' });
    await app().queueDialog('open', { filePaths: [dir] });
    await app().runCommand('file.open', 0);
    await expect
      .poll(async () => (await windowState(app(), 0)).fiddle.source.localPath)
      .toBe(dir);

    await app().runCommand('app.newWindow');
    await app().waitForWindow(1);
    const second = await windowState(app(), 1);
    await app().queueDialog('open', { filePaths: [dir] });
    await app().runCommand('file.open', 1);
    await expect.poll(async () => (await app().windows())[0]?.focused).toBe(true);
    const after = await windowState(app(), 1);
    expect(after.fiddle.source.localPath).toBeUndefined();
    expect(after.fiddle.fiddleRev).toBe(second.fiddle.fiddleRev);

    await app().runCommand('file.close', 1);
    await expect.poll(async () => (await app().windows()).length).toBe(1);
  });

  it('opens a second window with its own fiddle, and closes it with CmdOrCtrl+W', async () => {
    await app().press('CmdOrCtrl+Shift+N');
    await app().waitForWindow(1);
    const first = await windowState(app(), 0);
    const second = await windowState(app(), 1);
    expect(second.windowId).not.toBe(first.windowId);
    expect(second.fiddle.name).not.toBe(first.fiddle.name);

    await app().call('press', { key: 'CmdOrCtrl+W', window: 1 });
    await expect.poll(async () => (await app().windows()).length).toBe(1);
  });
});
