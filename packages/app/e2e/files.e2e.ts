// The file list: add files, and the validation errors for names the fiddle
// can't take. Rename, hide and delete go through the row's context menu,
// which a product bug breaks (see the last test).
import { describe, expect, it } from 'vitest';

import { role, useApp, windowState } from './harness.ts';

const FAILED = "Couldn't change the file";

describe('files', () => {
  const app = useApp();
  const files = async () => (await windowState(app())).fiddle.files;
  const names = async () => (await files()).map((file) => file.name);
  const failures = async () => (await app().snapshot(0)).split(FAILED).length - 1;

  const addFile = async (name: string) => {
    await app().click(role('button', 'Add file'));
    await app().query(role('dialog', 'New file'));
    await app().type(name, role('textbox', 'File name'));
  };

  it('adds a file, confirming its name with Enter @feature files.operations keys.new-file-name keys.confirm-dialog', async () => {
    await addFile('extra.js');
    await app().press('Enter');
    await app().waitForAbsent(role('dialog', 'New file'));
    // A new file is unsaved, and its tab says so.
    await app().query(role('tab', /^extra\.js\b/));
    expect(await files()).toContainEqual({ name: 'extra.js', visible: true });
    expect((await windowState(app())).fiddle.activeFile).toBe('extra.js');
  });

  it('cancels a new file with Escape @feature keys.new-file-name', async () => {
    await addFile('cancelled.js');
    await app().press('Escape');
    await app().waitForAbsent(role('dialog', 'New file'));
    expect(await names()).not.toContain('cancelled.js');
  });

  it.each([
    ['an unsupported extension', 'notes.md'],
    ['a path separator', 'lib/util.js'],
    ['a duplicate name', 'extra.js'],
    ['a reserved name', 'package.json'],
    ['a second main entry', 'main.mjs'],
  ])('refuses %s @feature files.extensions files.no-duplicates files.reserved-names files.one-main', async (_what, name) => {
    const before = await files();
    const shown = await failures();
    await addFile(name);
    await app().press('Enter');
    await expect.poll(failures).toBeGreaterThan(shown);
    expect(await files()).toEqual(before);
  });

  // Product bug (src/renderer/features/files/Sidebar.tsx): when the file menu
  // closes, `menu` becomes null, so the first item switches from
  // <MenuItem id="hide"> to <MenuItem id="show"> while the menu is still
  // mounted. React Aria throws "Cannot change the id of an item" and the
  // window goes blank. Any action, or Escape, triggers it. Keep this test last.
  it.fails('renames a file from its context menu (known bug)', async () => {
    await app().press('Shift+F10', role('row', 'extra.js'));
    await app().click(role('menuitem', 'Rename…'));
    await app().query(role('dialog', 'Rename extra.js', { timeout: 3000 }));
  });
});
