import { cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../log', () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { log } from '../log';
import { importElectronVersions, importOldApp, type ImportDeps } from './import';

const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));
const token = `ghp_${'Fx7q'.repeat(9)}`;

/** A fake safeStorage: the old app's sync format is `old:<text>`, the async one `new:<text>`. */
const safeStorage: ImportDeps['safeStorage'] = {
  decryptString: (data) => {
    const text = data.toString();
    if (!text.startsWith('old:')) throw new Error('cannot decrypt');
    return text.slice(4);
  },
  isAsyncEncryptionAvailable: async () => true,
  encryptStringAsync: async (text) => Buffer.from(`new:${text}`),
  decryptStringAsync: async (data) => ({ result: data.toString().slice(4), shouldReEncrypt: false }),
  getSelectedStorageBackend: () => 'gnome_libsecret',
};

let root: string;
let userData: string;
let home: string;
let localStorage: Record<string, string> | undefined;

function deps(overrides: Partial<ImportDeps> = {}): ImportDeps {
  return {
    userData,
    home,
    version: '1.0.0',
    osUser: 'jane',
    platform: 'linux',
    readLocalStorage: async () => localStorage,
    safeStorage,
    now: () => new Date('2026-09-13T12:00:00.000Z'),
    ...overrides,
  };
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(userData, file), 'utf8')) as Record<string, unknown>;
}

/** Every file under `dir` with its content, to prove old files are left untouched. */
async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    out[path.relative(dir, file)] = await readFile(file, 'utf8');
  }
  return out;
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'fiddle-import-'));
  userData = path.join(root, 'user-data');
  home = path.join(root, 'home');
  await cp(path.join(fixtures, 'user-data'), userData, { recursive: true });
  await cp(path.join(fixtures, 'home'), home, { recursive: true });
  await writeFile(path.join(userData, '.github-credentials'), `old:${token}`);
  localStorage = JSON.parse(await readFile(path.join(fixtures, 'local-storage.json'), 'utf8')) as Record<
    string,
    string
  >;
  vi.mocked(log.warn).mockClear();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('importOldApp', () => {
  it('imports settings, tour state, local builds, the token and themes on the first launch', async () => {
    const result = await importOldApp(deps());
    expect(result.firstLaunch).toBe(true);

    const settings = await readJson('settings.json');
    expect(settings).toMatchObject({
      schemaVersion: 1,
      theme: 'dracula',
      editorFontSize: 15,
      keybindings: { 'file.save': null, 'file.saveAs': null },
      packageManager: 'yarn',
    });
    expect(settings).not.toHaveProperty('gistPublishAsRevision');

    const { builds } = (await readJson('local-builds.json')) as { builds: Record<string, string>[] };
    expect(builds.map(({ id: _id, ...rest }) => rest)).toEqual([
      { name: 'My build', path: '/src/electron/out/Testing', addedAt: '2023-11-14T22:13:20.000Z' },
      { name: 'Release', path: '/src/electron/out/Release', addedAt: '2023-11-14T22:13:20.001Z' },
      { name: 'Old build', path: '/src/electron-old/out/Testing', addedAt: '2023-07-22T04:26:40.000Z' },
    ]);
    expect(new Set(builds.map((build) => build.id)).size).toBe(3);

    const credentials = await readFile(path.join(userData, 'credentials', 'github'), 'utf8');
    expect(credentials).toBe(`new:${JSON.stringify({ token, login: 'octocat' })}`);
    expect((await stat(path.join(userData, 'credentials', 'github'))).mode & 0o777).toBe(0o600);

    const theme = JSON.parse(await readFile(path.join(userData, 'themes', 'dracula.json'), 'utf8'));
    expect(theme).toEqual({
      schemaVersion: 1,
      name: 'Dracula',
      isDark: true,
      editor: {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6272a4' },
          { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        ],
        colors: { 'editor.background': '#282a36', 'editor.foreground': '#f8f8f2' },
      },
      common: {},
    });

    expect(await readJson('state.json')).toEqual({
      schemaVersion: 1,
      tourDone: true,
      importedFrom: { version: '1.0.0', at: '2026-09-13T12:00:00.000Z' },
    });
    expect(log.warn).toHaveBeenCalledWith('import: ignoring unknown localStorage keys', ['devtools-extension-state']);
  });

  it('never moves, changes or deletes old files', async () => {
    const before = { userData: await snapshot(userData), home: await snapshot(home) };
    await importOldApp(deps());
    const after = await snapshot(userData);
    for (const [file, content] of Object.entries(before.userData)) expect(after[file]).toBe(content);
    expect(await snapshot(home)).toEqual(before.home);
  });

  it('runs once: a second launch changes nothing', async () => {
    await importOldApp(deps());
    const first = await snapshot(userData);
    localStorage = { fontSize: '20' };
    const again = await importOldApp(deps({ now: () => new Date('2030-01-01T00:00:00.000Z') }));
    expect(again.firstLaunch).toBe(false);
    expect(await snapshot(userData)).toEqual(first);
  });

  it('never overwrites files that exist when an interrupted import runs again', async () => {
    await writeFile(path.join(userData, 'settings.json'), '{"schemaVersion":1,"editorFontSize":12}\n');
    await writeFile(path.join(userData, 'state.json'), '{"schemaVersion":1,"sessions":[]}\n');
    const result = await importOldApp(deps());
    expect(result.firstLaunch).toBe(true);
    expect(await readJson('settings.json')).toEqual({ schemaVersion: 1, editorFontSize: 12 });
    // Other slices' keys in state.json are kept.
    expect(await readJson('state.json')).toMatchObject({ sessions: [], importedFrom: { version: '1.0.0' } });
  });

  it('records the import even without an old app', async () => {
    const empty = path.join(root, 'empty');
    const result = await importOldApp(
      deps({ userData: empty, home: empty, readLocalStorage: async () => undefined }),
    );
    expect(result.firstLaunch).toBe(true);
    expect(await readdir(empty)).toEqual(['state.json']);
  });

  it('keeps going when the old token cannot be decrypted or localStorage cannot be read', async () => {
    await writeFile(path.join(userData, '.github-credentials'), 'garbage');
    const result = await importOldApp(
      deps({
        readLocalStorage: async () => {
          throw new Error('window failed');
        },
      }),
    );
    expect(result.summary).toMatchObject({ github: 'undecryptable', themes: 1, localBuilds: 2 });
    await expect(stat(path.join(userData, 'credentials', 'github'))).rejects.toThrow();
    await expect(stat(path.join(userData, 'settings.json'))).rejects.toThrow();
  });

  it('keeps the token for the session only on Linux without a keyring', async () => {
    const weak = { ...safeStorage, getSelectedStorageBackend: () => 'basic_text' };
    const result = await importOldApp(deps({ safeStorage: weak }));
    expect(result.summary.github).toBe('session-only');
    await expect(stat(path.join(userData, 'credentials', 'github'))).rejects.toThrow();
  });
});

describe('importElectronVersions', () => {
  it('copies extracted versions into the per-version cache, once', async () => {
    const cache = path.join(root, 'cache', 'electron');
    const oldBin = path.join(userData, 'electron-bin');
    expect((await importElectronVersions(oldBin, cache)).sort()).toEqual(['29.1.0', '30.0.0']);
    expect(await readFile(path.join(cache, '30.0.0', 'version'), 'utf8')).toBe('30.0.0\n');
    expect(await readFile(path.join(cache, '29.1.0', 'version'), 'utf8')).toBe('v29.1.0\n');
    expect(await importElectronVersions(oldBin, cache)).toEqual([]);
    // The old folder is untouched.
    expect(await readFile(path.join(oldBin, 'current', 'version'), 'utf8')).toBe('30.0.0\n');
  });

  it('does nothing without an old electron-bin folder', async () => {
    expect(await importElectronVersions(path.join(root, 'nope'), path.join(root, 'cache'))).toEqual([]);
  });
});
