// The window's parts, panels, the split editor and multiple windows.
import { describe, expect, it } from 'vitest';

import { makeFolder, role, useApp, windowState } from './harness.ts';

describe('workspace', () => {
  const app = useApp();
  const layout = async () => (await windowState(app())).layout;

  it('shows the editor, console, files, packages and the toolbar controls @feature workspace.editor workspace.console workspace.sidebar workspace.controls', async () => {
    await app().query(role('code'));
    await app().query(role('region', 'Console'));
    await app().query(role('navigation', 'Files'));
    await app().query(role('region', 'Packages'));
    await app().query(role('group', 'Toolbar'));
    await app().query(role('button', /^Electron \d+\.\d+\.\d+/));
    await app().query(role('button', 'Run'));
    await app().query(role('button', 'Publish'));
  });

  it('opens one editor tab per visible file @feature editor.per-file', async () => {
    const { fiddle } = await windowState(app());
    const tabs = (await app().query(role('tab'))).map((tab) => tab.name).sort();
    expect(tabs).toEqual(fiddle.files.filter((file) => file.visible).map((file) => file.name).sort());
  });

  it('splits the editor and closes the split @feature editor.panes', async () => {
    await app().click(role('button', 'Split editor'));
    await expect.poll(async () => (await layout()).split).toBe('renderer.js');
    expect(await app().query(role('code'))).toHaveLength(2);
    await app().click(role('button', 'Close split', { nth: 0 }));
    await expect.poll(async () => (await layout()).split).toBe(null);
    expect(await app().query(role('code'))).toHaveLength(1);
  });

  it('hides and shows the sidebar and the console @feature workspace.panels console.visibility', async () => {
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

  it('routes undo, redo, select all and copy to the editor @feature keys.edit keys.clipboard', async () => {
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

  it('shows the editor diagnostics on the file tab @feature editor.diagnostics', async () => {
    await app().click(role('tab', /^renderer\.js\b/));
    await app().click(role('code'));
    await app().type('const = ;');
    await app().query(role('tab', /^renderer\.js , \d+ errors?\b/, { timeout: 10_000 }));
    for (let i = 0; i < 10 && (await windowState(app())).fiddle.dirty; i++) await app().press('CmdOrCtrl+Z');
    await expect.poll(async () => (await windowState(app())).fiddle.dirty).toBe(false);
    await app().query(role('tab', 'renderer.js', { timeout: 10_000 }));
  });

  it('focuses the window that already has a folder open @feature new.focus-open-folder', async () => {
    const dir = makeFolder(app(), 'shared', { 'main.js': '// shared\n' });
    await app().queueDialog('open', { filePaths: [dir] });
    await app().runCommand('file.open', 0);
    await expect.poll(async () => (await windowState(app(), 0)).fiddle.source.localPath).toBe(dir);

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

  it('opens a second window with its own fiddle, and closes it with CmdOrCtrl+W @feature workspace.multi-window keys.new-window keys.minimize-close', async () => {
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
