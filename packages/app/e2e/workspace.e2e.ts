// The window's parts, panels, the split editor and multiple windows.
import { describe, expect, it } from 'vitest';

import { role, useApp, windowState } from './harness.ts';

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
