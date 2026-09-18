import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { mapOldSettings } from './old-settings';

const oldValues = JSON.parse(
  readFileSync(new URL('./fixtures/local-storage.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const options = { themeIds: new Map([['dracula', 'dracula']]), osUser: 'jane' };

describe('mapOldSettings', () => {
  it('maps every old setting to the new sparse settings', () => {
    const result = mapOldSettings(oldValues, options);
    expect(result.settings).toEqual({
      theme: 'dracula',
      editorFontFamily: 'Fira Code',
      editorFontSize: 15,
      clearConsoleOnRun: true,
      gistShowHistory: false,
      gistVisibility: 'public',
      packageAuthor: 'Octo Cat',
      keybindings: { 'file.save': null, 'file.saveAs': null },
      mirror: 'custom',
      customMirrorElectron: 'https://mirror.example.com/electron/',
      customMirrorNightly: 'https://mirror.example.com/nightly/',
      channels: ['stable', 'beta', 'nightly'],
      showNotDownloaded: false,
      showObsolete: true,
      keepUserDataDirs: true,
      electronLogging: true,
      electronFlags: ['--js-flags=--expose-gc'],
      environmentVariables: ['DEBUG=electron*'],
      packageManager: 'yarn',
      socketFirewall: false,
    });
    expect(result.tourDone).toBe(true);
    expect(result.gitHubLogin).toBe('octocat');
    expect(result.localVersions).toEqual([
      {
        version: '0.0.0-local.1690000000000',
        localPath: '/src/electron-old/out/Testing',
        name: 'Old build',
      },
    ]);
    expect(result.ignored.sort()).toEqual(['known-electron-versions', 'version']);
    expect(result.unknown).toEqual(['devtools-extension-state']);
    expect(result.invalid).toEqual([]);
  });

  it('leaves values that equal the new defaults out', () => {
    const result = mapOldSettings(
      {
        isPublishingGistAsRevision: 'true',
        isUsingSocketFirewall: 'true',
        packageManager: 'npm',
        channelsToShow: '["Stable","Beta"]',
        acceleratorsToBlock: '[]',
        executionFlags: '[]',
        electronMirror: '{"sourceType":"DEFAULT","sources":{}}',
        isUsingSystemTheme: 'true',
        theme: 'dracula',
        packageAuthor: 'jane',
      },
      options,
    );
    expect(result.settings).toEqual({});
    expect(result.invalid).toEqual([]);
  });

  it('maps the built-in themes to an appearance when the system theme was off', () => {
    const map = (theme?: string) =>
      mapOldSettings(
        { isUsingSystemTheme: 'false', ...(theme ? { theme } : {}) },
        options,
      ).settings;
    expect(map('defaultLight')).toEqual({ appearance: 'light' });
    expect(map('defaultDark')).toEqual({ appearance: 'dark' });
    expect(map()).toEqual({ appearance: 'dark' });
    expect(map('dracula.json')).toEqual({ theme: 'dracula' });
    // A custom theme that couldn't be imported falls back to the dark built-in theme.
    expect(map('missing')).toEqual({ appearance: 'dark' });
  });

  it('maps the China mirror', () => {
    expect(
      mapOldSettings({ electronMirror: '{"sourceType":"CHINA"}' }, options).settings,
    ).toEqual({
      mirror: 'china',
    });
  });

  it('reports values that do not fit the new schema', () => {
    const result = mapOldSettings(
      {
        fontSize: 'huge',
        packageManager: 'pnpm',
        isClearingConsoleOnRun: 'maybe',
        channelsToShow: '["Canary"]',
      },
      options,
    );
    expect(result.settings).toEqual({});
    expect(result.invalid.sort()).toEqual([
      'channelsToShow',
      'fontSize',
      'isClearingConsoleOnRun',
      'packageManager',
    ]);
  });
});
