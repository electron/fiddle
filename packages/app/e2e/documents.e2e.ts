// Unsaved state, Save, Save As, Open and Save as Forge project, with the native
// dialogs answered from the queue.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  dialogMessages,
  makeFolder,
  readJson,
  role,
  useApp,
  windowState,
} from './harness.ts';

interface PackageJson {
  name?: string;
  productName?: string;
  version?: string;
  main?: string;
  author?: string;
  license?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  config?: { forge?: { makers?: { name: string }[] } };
}

describe('documents', () => {
  const app = useApp();
  const fiddle = async () => (await windowState(app())).fiddle;
  const title = async () => (await app().windows())[0]?.title;
  const read = (dir: string, file: string) =>
    fs.readFileSync(path.join(dir, file), 'utf8');
  const edit = async (value: string) => {
    await app().click(role('code'));
    await app().type(value);
    await expect.poll(async () => (await fiddle()).dirty).toBe(true);
  };

  it('shows unsaved changes in the window title', async () => {
    const { name } = await fiddle();
    expect(await title()).toBe(name);
    await edit('// edited');
    await expect.poll(title).toBe(`${name} (edited)`);
    expect((await fiddle()).dirtyFiles).toEqual(['main.js']);
    // The title bar's "Edited" marker is hidden where the drawn menu bar takes the room (Linux, Windows).
    await app().query(role('tab', /^main\.js , Unsaved changes$/));
  });

  it('saves to a new folder, asking for it only the first time', async () => {
    const dir = path.join(makeFolder(app(), 'parent'), 'my-fiddle');
    await app().queueDialog('open', { filePaths: [dir] });
    await app().press('CmdOrCtrl+S');
    await expect.poll(async () => (await fiddle()).dirty).toBe(false);

    const saved = await fiddle();
    expect(saved.name).toBe('my-fiddle');
    expect(saved.source.localPath).toBe(dir);
    await expect.poll(title).toBe('my-fiddle');
    const picker = (await app().dialogs()).at(-1);
    expect(picker).toMatchObject({ kind: 'open', scripted: true });
    expect(picker?.options.properties).toContain('createDirectory');

    expect(read(dir, 'main.js')).toContain('// edited');
    expect(read(dir, '.gitignore').split(/\r?\n/)).toEqual(
      expect.arrayContaining(['node_modules', 'out']),
    );
    const pkg = readJson<PackageJson>(path.join(dir, 'package.json'));
    const version = saved.versionRef.kind === 'release' ? saved.versionRef.version : '';
    expect(pkg.main).toMatch(/^(\.\/)?main\.js$/);
    expect(pkg).toMatchObject({
      name: 'my-fiddle',
      version: '1.0.0',
      author: os.userInfo().username,
      scripts: { start: 'electron .' },
      devDependencies: { electron: version },
    });
    expect(pkg.productName).toBeTruthy();
    // Saved folders become OS recent documents (the dock menu and the jump list).
    const recent = (await app().sideEffects()).filter(
      (effect) => effect.kind === 'app.addRecentDocument',
    );
    expect(recent.map((effect) => effect.args[0])).toContain(dir);

    // The folder is known now: saving again doesn't ask.
    const dialogs = (await app().dialogs()).length;
    await edit('// again');
    await app().press('CmdOrCtrl+S');
    await expect.poll(async () => (await fiddle()).dirty).toBe(false);
    expect((await app().dialogs()).length).toBe(dialogs);
    expect(read(dir, 'main.js')).toContain('// again');
  });

  it('always asks with Save As, and warns before replacing files', async () => {
    const other = makeFolder(app(), 'other', { 'main.js': '// old\n' });
    await app().queueDialog('open', { filePaths: [other] });
    await app().queueDialog('messageBox', { button: 'Replace' });
    await app().press('CmdOrCtrl+Shift+S');
    await expect.poll(async () => (await fiddle()).source.localPath).toBe(other);
    expect(await dialogMessages(app())).toContain('Replace the files in “other”?');
    expect(read(other, 'main.js')).toContain('// again');
  });

  it('opens a folder, asking before it replaces unsaved changes', async () => {
    const opened = makeFolder(app(), 'opened', {
      'main.js': "console.log('opened');\n",
      'index.html': '<!doctype html>\n',
      'notes.md': 'not a fiddle file\n',
      'package.json': JSON.stringify({
        dependencies: { 'left-pad': '1.3.0' },
        devDependencies: { electron: '43.7.0' },
      }),
    });
    await edit('// unsaved');
    await app().queueDialog('messageBox', { button: 'Discard changes' });
    await app().queueDialog('open', { filePaths: [opened] });
    await app().press('CmdOrCtrl+O');
    await expect.poll(async () => (await fiddle()).name).toBe('opened');

    const loaded = await fiddle();
    expect(loaded).toMatchObject({
      dirty: false,
      modules: { 'left-pad': '1.3.0' },
      versionRef: { kind: 'release', version: '43.7.0' },
      source: { localPath: opened },
    });
    expect(loaded.files.map((file) => file.name)).not.toContain('notes.md');
    expect(await dialogMessages(app())).toContain('Discard your unsaved changes?');
  });

  it('warns about an invalid package.json and still loads the folder', async () => {
    const bad = makeFolder(app(), 'bad-json', {
      'main.js': '// bad json\n',
      'package.json': '{ nope',
    });
    await app().queueDialog('open', { filePaths: [bad] });
    await app().queueDialog('messageBox', { response: 0 });
    await app().runCommand('file.open');
    await expect.poll(async () => (await fiddle()).name).toBe('bad-json');
    await expect
      .poll(() => dialogMessages(app()))
      .toContain('The fiddle loaded with warnings');
    const warning = (await app().dialogs()).find(
      (d) => d.options.message === 'The fiddle loaded with warnings',
    );
    expect(String(warning?.options.detail)).toContain("package.json isn't valid JSON");
  });

  it('saves a Forge project', async () => {
    const dir = path.join(makeFolder(app(), 'forge-parent'), 'forge-fiddle');
    await app().queueDialog('open', { filePaths: [dir] });
    await app().runCommand('file.saveAsForge');
    await expect.poll(() => fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
    // An export: the window is not relinked to the Forge folder.
    expect((await fiddle()).source.localPath).not.toBe(dir);

    const pkg = readJson<PackageJson>(path.join(dir, 'package.json'));
    expect(pkg.license).toBe('MIT');
    expect(pkg.devDependencies).toHaveProperty('@electron-forge/cli');
    expect(pkg.scripts).toMatchObject({
      start: 'electron-forge start',
      package: 'electron-forge package',
      make: 'electron-forge make',
      publish: 'electron-forge publish',
    });
    expect(pkg.config?.forge?.makers?.map((maker) => maker.name)).toEqual([
      '@electron-forge/maker-squirrel',
      '@electron-forge/maker-zip',
      '@electron-forge/maker-deb',
      '@electron-forge/maker-rpm',
    ]);
  });

  it('starts a new test from the test-template branch with CmdOrCtrl+T', async () => {
    await app().press('CmdOrCtrl+T');
    await expect.poll(async () => (await fiddle()).source.templateName).toBe('test');
    expect(app.fixtures().requests.map((r) => r.path)).toContain(
      '/minimal-repro/archive/test-template.zip',
    );
  });

  it('asks before closing a window with unsaved changes', async () => {
    await edit('// unsaved');
    await app().queueDialog('messageBox', { button: 'Cancel' });
    await app().press('CmdOrCtrl+W');
    await expect
      .poll(() => dialogMessages(app()))
      .toContainEqual(expect.stringMatching(/^Save changes to “.+” before closing\?$/));
    expect(await app().windows()).toHaveLength(1);
  });

  it('asks before quitting with unsaved changes', async () => {
    await app().queueDialog('messageBox', { button: 'Cancel' });
    await app().call('quit', {});
    await expect
      .poll(() => dialogMessages(app()))
      .toContain('Quit with unsaved changes?');
    expect(await app().windows()).toHaveLength(1);
    // The harness quits after the last test.
    await app().queueDialog('messageBox', { button: 'Quit' });
  });
});
