// The settings page: defaults, changes, persistence, sync, reset, search,
// themes, and import and export.
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appState,
  makeFolder,
  readJson,
  role,
  text,
  useApp,
  windowState,
  type AppState,
} from './harness.ts';

describe('settings', () => {
  const app = useApp();
  const settings = async () => (await appState(app())).settings;
  const setting = (key: string) => async () => (await settings())[key];
  const open = async (section: string) => {
    if ((await windowState(app())).view !== 'settings')
      await app().click(role('button', 'Settings'));
    await app().click(role('button', section));
    await app().query(role('region', section));
  };
  const states = async (query: Parameters<ReturnType<typeof app>['query']>[0]) =>
    (await app().query(query))[0]?.states ?? [];
  const openedPaths = async () =>
    (await app().sideEffects())
      .filter((e) => e.kind === 'shell.openPath')
      .map((e) => String(e.args[0]));

  it('starts with the documented defaults', async () => {
    expect(await settings()).toMatchObject({
      appearance: 'system',
      theme: 'lucent',
      clearConsoleOnRun: false,
      keepUserDataDirs: false,
      electronLogging: false,
      electronFlags: [],
      environmentVariables: [],
      packageManager: 'npm',
      socketFirewall: true,
      channels: ['stable', 'beta'],
      showNotDownloaded: true,
      showObsolete: false,
      mirror: 'auto',
      gistPublishAsRevision: true,
      gistVisibility: 'secret',
      gistShowHistory: true,
      sessionRestore: true,
    });
    await open('Execution');
    expect(await states(role('switch', 'Clear the console on every run'))).not.toContain(
      'checked',
    );
    expect(await states(role('switch', 'Keep user data folders'))).not.toContain(
      'checked',
    );
    expect(await states(role('switch', 'Advanced Electron logging'))).not.toContain(
      'checked',
    );
    expect(await states(role('switch', 'Use Socket Firewall'))).toContain('checked');
    expect(await states(role('radio', 'npm'))).toContain('checked');
  });

  it('saves a change to settings.json and syncs it to every window', async () => {
    await open('Execution');
    await app().click(role('switch', 'Clear the console on every run'));
    await expect.poll(setting('clearConsoleOnRun')).toBe(true);

    const file = path.join(app().testDir ?? '', 'userData', 'settings.json');
    await expect
      .poll(() => fs.existsSync(file) && readJson(file).clearConsoleOnRun)
      .toBe(true);

    await app().runCommand('app.newWindow');
    await app().waitForWindow(1);
    expect(((await app().stores(1)).app as AppState).settings.clearConsoleOnRun).toBe(
      true,
    );
    await app().runCommand('file.close', 1);
    await expect.poll(async () => (await app().windows()).length).toBe(1);
  });

  it('marks a changed value and resets it', async () => {
    await open('Execution');
    expect(await app().snapshot(0)).toContain('image "Changed from the default"');
    await app().click(role('button', 'Reset'));
    await expect.poll(setting('clearConsoleOnRun')).toBe(false);
    expect(await app().snapshot(0)).not.toContain('Changed from the default');
  });

  it('searches every section', async () => {
    await open('Execution');
    await app().type('socket', role('textbox', 'Search settings'));
    await app().query(role('switch', 'Use Socket Firewall'));
    await app().waitForAbsent(role('radiogroup', 'Package manager'));
    await app().press('CmdOrCtrl+A', role('textbox', 'Search settings'));
    await app().press('Backspace');
    await app().query(role('radiogroup', 'Package manager'));
  });

  it('edits the execution settings', async () => {
    await open('Execution');
    await app().click(role('radio', 'yarn'));
    await expect.poll(setting('packageManager')).toBe('yarn');
    await app().click(role('radio', 'npm'));
    await expect.poll(setting('packageManager')).toBe('npm');

    await app().click(role('switch', 'Use Socket Firewall'));
    await expect.poll(setting('socketFirewall')).toBe(false);
    await app().click(role('switch', 'Keep user data folders'));
    await expect.poll(setting('keepUserDataDirs')).toBe(true);
    await app().click(role('switch', 'Advanced Electron logging'));
    await expect.poll(setting('electronLogging')).toBe(true);

    await app().click(role('button', 'Add row', { nth: 0 }));
    await app().type('--enable-logging', role('textbox', 'Electron flags'));
    await app().press('Tab');
    await expect.poll(setting('electronFlags')).toEqual(['--enable-logging']);

    await app().click(role('button', 'Add row', { nth: 1 }));
    await app().type('FOO=bar', role('textbox', 'Environment variables'));
    await app().press('Tab');
    await expect.poll(setting('environmentVariables')).toEqual(['FOO=bar']);
  });

  it('edits the Electron settings', async () => {
    await open('Electron');
    // The current version's channel can't be turned off.
    expect(await states(role('checkbox', 'Stable'))).toContain('disabled');
    await app().click(text(/^Nightly$/, { nth: 0 }));
    await expect.poll(setting('channels')).toEqual(['stable', 'beta', 'nightly']);

    await app().click(role('switch', 'Show obsolete versions'));
    await expect.poll(setting('showObsolete')).toBe(true);

    await app().click(role('switch', "Show versions that aren't downloaded"));
    await expect.poll(setting('showNotDownloaded')).toBe(false);
    // Nothing is downloaded, so the picker keeps only the current version.
    await app().click(role('button', /^Electron \d+\.\d+\.\d+/));
    const options = (await app().query(role('option'))).map((option) => option.name);
    expect(options.filter((name) => name.startsWith('Electron'))).toEqual([
      expect.stringMatching(/^Electron 44\.3\.0\b/),
    ]);
    await app().press('Escape');
    await app().waitForAbsent(role('listbox', 'Electron version'));
    await app().click(role('switch', "Show versions that aren't downloaded"));
    await expect.poll(setting('showNotDownloaded')).toBe(true);

    await app().click(text(/^China \(npmmirror\)$/));
    await expect.poll(setting('mirror')).toBe('china');
    await app().click(text(/^Custom$/));
    await app().query(role('textbox', 'Electron mirror URL'));
    await app().query(role('textbox', 'Nightly mirror URL'));
    await app().click(text(/^Automatic$/));
    await expect.poll(setting('mirror')).toBe('auto');
  });

  it('edits the GitHub settings', async () => {
    await open('GitHub');
    await app().click(role('switch', 'Publish as revision'));
    await expect.poll(setting('gistPublishAsRevision')).toBe(false);
    await app().click(role('switch', 'Show gist revision history'));
    await expect.poll(setting('gistShowHistory')).toBe(false);
    await app().click(role('radio', 'Public'));
    await expect.poll(setting('gistVisibility')).toBe('public');
    await app().type('E2E Author', role('textbox', 'package.json author'));
    await app().press('Tab');
    await expect.poll(setting('packageAuthor')).toBe('E2E Author');
  });

  it('edits the editor font', async () => {
    await open('Editor');
    await app().type('monospace', role('textbox', 'Font family'));
    await app().press('Tab');
    await expect.poll(setting('editorFontFamily')).toBe('monospace');
    await app().type('16', role('textbox', 'Font size'));
    await app().press('Tab');
    await expect.poll(setting('editorFontSize')).toBe(16);
  });

  it('switches between the light and dark themes and back to the system', async () => {
    await open('General');
    const theme = () =>
      app().evaluate(
        `[document.documentElement.dataset.theme ?? null, matchMedia('(prefers-color-scheme: dark)').matches]`,
        0,
      );
    await app().click(role('radio', 'Dark'));
    await expect.poll(theme).toEqual(['dark', true]);
    await app().click(role('radio', 'Light'));
    await expect.poll(theme).toEqual(['light', false]);
    await app().click(role('radio', 'System'));
    await expect.poll(async () => ((await theme()) as unknown[])[0]).toBe(null);
    expect(await settings()).toMatchObject({ appearance: 'system' });
  });

  it('creates and imports themes, and opens the themes folder', async () => {
    await open('General');
    await app().click(role('button', 'Create from current'));
    await expect.poll(async () => (await appState(app())).themes.length).toBe(1);

    const source = makeFolder(app(), 'theme-source', {
      'night.json': JSON.stringify({
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: { 'editor.background': '#101010' },
      }),
    });
    await app().queueDialog('open', { filePaths: [path.join(source, 'night.json')] });
    await app().click(role('button', 'Import Monaco theme…'));
    await expect.poll(async () => (await appState(app())).themes.length).toBe(2);

    await app().click(role('button', 'Open themes folder'));
    await expect.poll(openedPaths).toContainEqual(expect.stringMatching(/themes$/));
  });

  it('opens settings.json', async () => {
    await app().click(role('button', 'Open settings.json'));
    await expect
      .poll(openedPaths)
      .toContainEqual(expect.stringMatching(/settings\.json$/));
  });

  it('exports and imports settings', async () => {
    const dir = makeFolder(app(), 'settings-io');
    const exported = path.join(dir, 'exported.json');
    await app().queueDialog('save', { filePath: exported });
    await app().click(role('button', 'Export…'));
    // The file exists before it's written (a plain writeFile), so wait for the content.
    await expect
      .poll(() => (fs.existsSync(exported) ? fs.readFileSync(exported, 'utf8') : ''))
      .toContain('E2E Author');

    const imported = path.join(dir, 'imported.json');
    fs.writeFileSync(
      imported,
      fs.readFileSync(exported, 'utf8').replace('E2E Author', 'Imported Author'),
    );
    await app().queueDialog('open', { filePaths: [imported] });
    // Flags and variables change how fiddles run, so importing them asks first.
    await app().queueDialog('messageBox', { button: 'Import' });
    await app().click(role('button', 'Import…'));
    await expect.poll(setting('packageAuthor')).toBe('Imported Author');
  });

  it('lists the contributors', async () => {
    await open('About and credits');
    await app().query(role('heading', 'Contributors'));
    await app().query(text(/^\d+ contributions?$/, { nth: 0 }));
  });
});
