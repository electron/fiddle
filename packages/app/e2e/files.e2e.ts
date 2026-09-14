// The file list: add files, the validation errors for names the fiddle can't
// take, and the row's context menu (rename, hide, show and delete).
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

  it('renames, hides, shows and deletes a file from its context menu @feature files.operations', async () => {
    const fromMenu = async (file: string, item: string) => {
      await app().press('Shift+F10', role('row', file));
      await app().click(role('menuitem', item));
    };

    // Escape closes the menu and leaves the window intact.
    await app().press('Shift+F10', role('row', 'extra.js'));
    await app().query(role('menu', 'File actions'));
    await app().press('Escape');
    await app().waitForAbsent(role('menu', 'File actions'));

    await fromMenu('extra.js', 'Rename…');
    await app().query(role('dialog', 'Rename extra.js'));
    await app().press('CmdOrCtrl+A', role('textbox', 'File name'));
    await app().type('renamed.js');
    await app().press('Enter');
    await expect.poll(names).toContain('renamed.js');
    expect(await names()).not.toContain('extra.js');

    await fromMenu('renamed.js', 'Hide');
    await expect.poll(files).toContainEqual({ name: 'renamed.js', visible: false });
    // Clicking the row would open the file, which shows it again (§17.3), so
    // reopen the menu from the keyboard on the row, once the closed menu has
    // given focus back to it.
    await app().waitForAbsent(role('menu', 'File actions'));
    await app().waitForIdle();
    await app().press('Shift+F10');
    await app().click(role('menuitem', 'Show'));
    await expect.poll(files).toContainEqual({ name: 'renamed.js', visible: true });

    await fromMenu('renamed.js', 'Delete…');
    await app().query(role('alertdialog', 'Delete renamed.js?'));
    await app().click(role('button', 'Delete'));
    await expect.poll(names).not.toContain('renamed.js');
  });
});
