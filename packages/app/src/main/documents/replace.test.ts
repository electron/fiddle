/**
 * Loading another fiddle into a window (a new fiddle or test, a Show Me example, a gist, a folder):
 * a busy window keeps its fiddle, unsaved changes are asked about, and opened folders are remembered.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFiddle } from '../../fiddle/fiddle';
import { flushAndRemove, initFakeDocuments } from './test-helpers';

let userData = '';
const app = {
  getPath: () => userData,
  isPackaged: false,
  getAppPath: () => userData,
  addRecentDocument: vi.fn(),
  clearRecentDocuments: vi.fn(),
};
const messageBox = vi.fn();
const confirm = vi.fn();
const pickFolder = vi.fn();
const focused: string[] = [];

vi.mock('electron', () => ({ app, net: { fetch: vi.fn() } }));
vi.mock('../dialogs', () => ({
  messageBox: (...args: unknown[]) => messageBox(...args),
  confirm: (...args: unknown[]) => confirm(...args),
  pickFolder: (...args: unknown[]) => pickFolder(...args),
}));
// Every window is open and in front; focusing one is recorded.
vi.mock('../windows', () => ({
  getWindow: (id: string | undefined) =>
    id === undefined
      ? undefined
      : {
          isMinimized: () => false,
          focus: () => focused.push(id),
          setTitle: () => undefined,
        },
  sendWindowCommand: () => undefined,
}));
vi.mock('../i18n');
vi.mock('../test-mode', async (original) => ({
  ...(await original<typeof import('../test-mode')>()),
  getCacheRoot: () => path.join(userData, 'cache'),
}));

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const W = '11111111-1111-4111-8111-111111111111';
const version = { kind: 'release', version: '30.0.0' } as const;
const gistResult = (files: Record<string, string> = { 'main.js': 'from the gist' }) => ({
  id: ID,
  owner: 'octocat',
  description: '',
  public: true,
  url: '',
  revision: 'a'.repeat(40),
  files,
  origin: { kind: 'gist', owner: 'octocat', id: ID, sha: 'a'.repeat(40) },
});

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-replace-'));
  const staticDir = path.join(userData, 'static');
  fs.mkdirSync(path.join(staticDir, 'electron-quick-start'), { recursive: true });
  fs.writeFileSync(path.join(staticDir, 'electron-quick-start', 'main.js'), '// qs');
  fs.mkdirSync(path.join(staticDir, 'show-me', 'clipboard'), { recursive: true });
  fs.writeFileSync(path.join(staticDir, 'show-me', 'clipboard', 'main.js'), '// clip');
  vi.resetModules();
  focused.length = 0;
  for (const mock of [
    messageBox,
    confirm,
    pickFolder,
    app.addRecentDocument,
    app.clearRecentDocuments,
  ])
    mock.mockReset();
  messageBox.mockResolvedValue({ response: 1, checkboxChecked: false });
  confirm.mockResolvedValue(true);
});

afterEach(() => flushAndRemove(userData));

/** A folder under userData holding a `main.js` that names it. */
function makeFolder(name: string): string {
  const dir = path.join(userData, name);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'main.js'), `// ${name}`);
  return dir;
}

async function setup() {
  const documents = await import('./service');
  const model = await import('./model');
  const loadGist = vi.fn<(id: string) => Promise<unknown>>(async () => gistResult());
  const windows = initFakeDocuments(documents, {
    versions: {
      releases: () => [{ version: '30.0.0', supported: true }],
      release: (v: string) =>
        v === '30.0.0' ? { version: v, supported: true } : undefined,
    },
    github: { client: () => ({ loadGist }) },
  });
  await documents.openFiddleWindow({
    windowId: W,
    doc: model.createDoc(createFiddle({ files: { 'main.js': 'mine' }, version }), 'mine'),
  });
  /** Puts the window's run store in the state a run, package, make or bisect leaves it in. */
  const setRun = (run: object | undefined) => windows.set(W, { ...windows.get(W), run });
  const edit = () =>
    documents.editFile(W, 'main.js', 'edited', documents.getDoc(W).fiddleRev);
  const otherWindow = () => [...windows.keys()].find((id) => id !== W);
  return { documents, model, windows, loadGist, setRun, edit, otherWindow };
}

const running = { status: 'running', bisect: null };
const bisecting = { status: 'ready', bisect: { result: null } };

describe('a busy window', () => {
  it('keeps its fiddle while a run or a bisect is going, and says why', async () => {
    const { documents, setRun } = await setup();
    for (const run of [running, bisecting]) {
      setRun(run);
      await documents.newFiddleIn(W, 'template');
      expect(documents.getFiddle(W).files['main.js']).toBe('mine');
    }
    expect(messageBox).toHaveBeenCalledTimes(2);
    expect(messageBox).toHaveBeenCalledWith(
      W,
      expect.objectContaining({ type: 'info', message: 'busyMessage' }),
    );

    // A finished bisect no longer holds the window.
    setRun({ status: 'ready', bisect: { result: ['29.0.0', '30.0.0'] } });
    await documents.newFiddleIn(W, 'template');
    expect(documents.getFiddle(W).files['main.js']).toBe('// qs');
  });

  it('gives the loaded fiddle its own window when a run started during the load', async () => {
    let finish!: (gist: unknown) => void;
    const { documents, loadGist, setRun, windows, otherWindow } = await setup();
    loadGist.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const loading = documents.loadGistIn(W, ID);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    setRun(running);
    finish(gistResult());
    await loading;

    expect(documents.getFiddle(W).files['main.js']).toBe('mine');
    expect(windows.size).toBe(2);
    expect(documents.getFiddle(otherWindow()!).source.gistId).toBe(ID);
  });
});

describe('unsaved changes', () => {
  it('replaces text typed during the load too when the user agrees a second time', async () => {
    let finish!: (gist: unknown) => void;
    const { documents, model, loadGist, edit } = await setup();
    loadGist.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const loading = documents.loadGistIn(W, ID);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    edit();
    finish(gistResult());
    await loading;

    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      W,
      expect.objectContaining({ message: 'replaceMessage' }),
    );
    expect(documents.getFiddle(W).files['main.js']).toBe('from the gist');
    expect(model.isDirty(documents.getDoc(W))).toBe(false);
  });
});

describe('newFiddleIn', () => {
  it('opens a new window for a test fiddle when there is no window to load it in', async () => {
    const { documents, windows, otherWindow } = await setup();

    await documents.newFiddleIn(undefined, 'test');

    expect(windows.size).toBe(2);
    const opened = otherWindow()!;
    expect(documents.currentTemplateName(opened)).toBe('test');
    expect(documents.currentTemplateName(W)).toBeUndefined();
    expect(documents.getFiddle(opened).version).toEqual(version);
  });
});

describe('showMeIn', () => {
  it('loads a bundled example, keeping the window’s Electron version', async () => {
    const { documents } = await setup();

    await documents.showMeIn(W, 'Clipboard');

    const fiddle = documents.getFiddle(W);
    expect(fiddle.files['main.js']).toBe('// clip');
    expect(fiddle.origin).toEqual({ kind: 'example' });
    expect(fiddle.templateName).toBe('Clipboard');
    expect(fiddle.version).toEqual(version);
    expect(documents.getDoc(W).name).toBe('Clipboard');
  });

  it('rejects a name that is not an example', async () => {
    const { documents } = await setup();
    await expect(documents.showMeIn(W, 'NotAnExample')).rejects.toMatchObject({
      code: 'not-found',
      details: { reason: 'example-not-found', name: 'NotAnExample' },
    });
    expect(documents.getFiddle(W).files['main.js']).toBe('mine');
  });
});

describe('loadGistIn', () => {
  it('rejects anything that is not a gist ID or URL before asking GitHub', async () => {
    const { documents, loadGist } = await setup();
    await expect(documents.loadGistIn(W, 'https://example.test/x')).rejects.toMatchObject(
      { code: 'invalid-argument', details: { reason: 'invalid-gist-id' } },
    );
    expect(loadGist).not.toHaveBeenCalled();
  });

  it('warns about a package.json it cannot read and keeps the window’s modules', async () => {
    const { documents, loadGist } = await setup();
    documents.setFiddleModules(W, { lodash: '^4.17.0' });
    loadGist.mockResolvedValue(gistResult({ 'main.js': 'm', 'package.json': '{nope' }));

    await documents.loadGistIn(W, ID);

    expect(documents.getFiddle(W).modules).toEqual({ lodash: '^4.17.0' });
    expect(messageBox).toHaveBeenCalledWith(
      W,
      expect.objectContaining({ message: 'loadWarnings', detail: 'warnPackageJson' }),
    );
  });
});

describe('openFolderIn', () => {
  it('asks for the folder when none is given, and does nothing if the dialog is cancelled', async () => {
    const dir = makeFolder('picked');
    const { documents } = await setup();
    pickFolder.mockResolvedValueOnce(undefined).mockResolvedValueOnce(dir);

    await documents.openFolderIn(W);
    expect(documents.getFiddle(W).files['main.js']).toBe('mine');

    await documents.openFolderIn(W);
    expect(pickFolder).toHaveBeenCalledWith(W, {
      title: 'openFolderTitle',
      buttonLabel: 'open',
    });
    expect(documents.getFiddle(W).source.localPath).toBe(dir);
    expect(documents.getDoc(W).name).toBe('picked');
  });

  it('brings the window forward that already has the folder open instead of opening it twice', async () => {
    const dir = makeFolder('once');
    const { documents, windows } = await setup();
    await documents.openFolderIn(W, dir);
    focused.length = 0;

    await documents.openFolderIn(undefined, `${dir}${path.sep}.`);

    expect(focused).toEqual([W]);
    expect(windows.size).toBe(1);
  });
});

describe('recent folders', () => {
  it('keeps the ten most recently opened folders, latest first and each once, and tells the OS', async () => {
    const dirs = Array.from({ length: 11 }, (_, i) => makeFolder(`f${i}`));
    const { documents } = await setup();

    for (const dir of dirs) await documents.openFolderIn(W, dir);
    expect(documents.recentFolders()).toEqual(dirs.slice(1).reverse());
    expect(app.addRecentDocument).toHaveBeenLastCalledWith(dirs[10]);

    await documents.openFolderIn(W, dirs[5]!);
    expect(documents.recentFolders()).toEqual([
      dirs[5],
      ...dirs
        .slice(1)
        .reverse()
        .filter((d) => d !== dirs[5]),
    ]);

    documents.clearRecentFolders();
    expect(documents.recentFolders()).toEqual([]);
    expect(app.clearRecentDocuments).toHaveBeenCalledOnce();
  });
});
