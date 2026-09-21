/**
 * Save, replace, quit and session restore, through the real Documents service
 * with Electron's dialogs, windows and app faked.
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFiddle } from '../../fiddle/fiddle';
import { DEFAULT_LAYOUT } from '../../shared/stores';
import { initFakeDocuments } from './test-helpers';

let userData = '';
const appHandlers = new Map<string, (...args: unknown[]) => void>();
const app = {
  getPath: () => userData,
  isPackaged: false,
  getAppPath: () => userData,
  addRecentDocument: () => undefined,
  requestSingleInstanceLock: () => true,
  on: (event: string, handler: (...args: unknown[]) => void) =>
    void appHandlers.set(event, handler),
  quit: vi.fn(),
};
const messageBox = vi.fn();
const confirm = vi.fn();
const pickFolder = vi.fn();
vi.mock('electron', () => ({ app, net: { fetch: vi.fn() } }));
vi.mock('../dialogs', () => ({
  messageBox: (...args: unknown[]) => messageBox(...args),
  confirm: (...args: unknown[]) => confirm(...args),
  pickFolder: (...args: unknown[]) => pickFolder(...args),
}));
vi.mock('../windows', () => ({
  getWindow: () => undefined,
  sendWindowCommand: () => undefined,
}));
vi.mock('../i18n', () => ({
  tm: () => (key: string, options?: Record<string, string>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
  t: (key: string) => key,
}));
// Downloaded templates go under the test's userData, not the real cache.
vi.mock('../test-mode', async (original) => ({
  ...(await original<typeof import('../test-mode')>()),
  getCacheRoot: () => path.join(userData, 'cache'),
}));
/** A minimal-repro archive whose main.js is `// fixture main`. */
const templateZip = fs.readFileSync(
  new URL('../../fiddle/test-fixtures/minimal-repro.zip', import.meta.url),
);

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
/** Draft file names come from window IDs, which must look like UUIDs. */
const W = '11111111-1111-4111-8111-111111111111';
const W2 = '22222222-2222-4222-8222-222222222222';
const version = { kind: 'release', version: '30.0.0' } as const;

let folder = '';
beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-lifecycle-'));
  folder = path.join(userData, 'project');
  fs.mkdirSync(folder);
  fs.mkdirSync(path.join(userData, 'static', 'electron-quick-start'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(userData, 'static', 'electron-quick-start', 'main.js'),
    '// quick start',
  );
  vi.resetModules();
  appHandlers.clear();
  for (const mock of [messageBox, confirm, pickFolder, app.quit]) mock.mockReset();
  messageBox.mockResolvedValue({ response: 1, checkboxChecked: false });
  confirm.mockResolvedValue(true);
});

afterEach(async () => {
  await import('./service')
    .then((documents) => documents.getStateStore().flush())
    .catch(() => undefined);
  fs.rmSync(userData, { recursive: true, force: true });
});

function put(files: Record<string, string>, into = folder) {
  for (const [name, content] of Object.entries(files))
    fs.writeFileSync(path.join(into, name), content);
}

async function setup(
  options: { sessionRestore?: boolean; loadGist?: (id: string) => Promise<unknown> } = {},
) {
  const documents = await import('./service');
  const model = await import('./model');
  const windows = initFakeDocuments(documents, {
    sessionRestore: options.sessionRestore,
    versions: {
      releases: () => [{ version: '30.0.0', supported: true }],
      release: (v: string) =>
        v === '30.0.0' ? { version: v, supported: true } : undefined,
      localBuild: (id: string) =>
        id === 'build' ? { id, name: 'build', path: '/builds/x' } : undefined,
    },
    github: { client: () => ({ loadGist: options.loadGist }) },
  });
  const open = (files: Record<string, string>, source: { localPath?: string } = {}) =>
    documents.openFiddleWindow({
      windowId: W,
      doc: model.createDoc(createFiddle({ files, version, source }), 'fiddle'),
    });
  return { documents, model, windows, open };
}

const onDisk = (dir = folder) =>
  fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort();

describe('saveIn', () => {
  it('deletes the files that were removed or renamed in the fiddle', async () => {
    put({ 'main.js': 'main', 'renderer.js': 'r', 'utils.js': 'u', 'notes.md': 'mine' });
    const { documents, model, open } = await setup();
    await open(
      { 'main.js': 'main', 'renderer.js': 'r', 'utils.js': 'u' },
      { localPath: folder },
    );
    documents.updateDoc(W, (doc) => model.docRemoveFile(doc, 'utils.js'));
    documents.updateDoc(W, (doc) => model.docRenameFile(doc, 'renderer.js', 'view.js'));

    expect(await documents.saveIn(W, 'save')).toBe(true);

    expect(onDisk()).toEqual(['main.js', 'notes.md', 'package.json', 'view.js']);
    expect(model.isDirty(documents.getDoc(W))).toBe(false);
    // The removed files are not ours to delete a second time.
    put({ 'utils.js': 'a new file of the user' });
    await documents.saveIn(W, 'save');
    expect(onDisk()).toContain('utils.js');
  });

  it('ends a case-only rename with the new name', async () => {
    put({ 'main.js': 'main' });
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'main' }, { localPath: folder });
    documents.updateDoc(W, (doc) => model.docRenameFile(doc, 'main.js', 'Main.js'));
    await documents.saveIn(W, 'save');
    expect(onDisk()).toEqual(['Main.js', 'package.json']);
  });

  it('leaves another folder alone on Save as, which never held these files', async () => {
    const other = path.join(userData, 'other');
    fs.mkdirSync(other);
    put({ 'renderer.js': 'someone else', 'main.js': 'old' }, other);
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'main', 'renderer.js': 'r' }, { localPath: folder });
    documents.updateDoc(W, (doc) => model.docRemoveFile(doc, 'renderer.js'));
    pickFolder.mockResolvedValue(other);

    await documents.saveIn(W, 'saveAs');

    expect(onDisk(other)).toEqual(['main.js', 'package.json', 'renderer.js']);
    expect(fs.readFileSync(path.join(other, 'renderer.js'), 'utf8')).toBe('someone else');
    expect(documents.getFiddle(W).source.localPath).toBe(other);
  });

  it('lists the files it will delete in the overwrite warning when saving as into its own folder', async () => {
    put({ 'main.js': 'main', 'renderer.js': 'r' });
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'main', 'renderer.js': 'r' }, { localPath: folder });
    documents.updateDoc(W, (doc) => model.docRemoveFile(doc, 'renderer.js'));
    pickFolder.mockResolvedValue(folder);
    confirm.mockResolvedValue(false);

    expect(await documents.saveIn(W, 'saveAs')).toBe(false);

    const detail = (confirm.mock.calls[0]![1] as { detail: string }).detail;
    expect(detail).toContain('renderer.js');
    expect(fs.existsSync(path.join(folder, 'renderer.js'))).toBe(true);
  });

  it('exports a Forge project without linking the window to it, so a plain Save keeps its own folder', async () => {
    put({ 'main.js': 'main' });
    const exported = path.join(userData, 'forge');
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'main' }, { localPath: folder });
    documents.updateDoc(
      W,
      (doc) => model.applyEdit(doc, 'main.js', 'edited', doc.fiddleRev) ?? doc,
    );
    pickFolder.mockResolvedValue(exported);

    expect(await documents.saveIn(W, 'forge')).toBe(true);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(exported, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.start).toBe('electron-forge start');
    expect(documents.getFiddle(W).source.localPath).toBe(folder);
    expect(model.isDirty(documents.getDoc(W))).toBe(true);
    expect(documents.recentFolders()).toEqual([]);

    await documents.saveIn(W, 'save');
    expect(fs.readFileSync(path.join(folder, 'main.js'), 'utf8')).toBe('edited');
    expect(
      JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8')).scripts,
    ).toEqual({ start: 'electron .' });
    expect(
      JSON.parse(fs.readFileSync(path.join(exported, 'package.json'), 'utf8')).scripts
        .start,
    ).toBe('electron-forge start');
  });

  it('keeps the fiddle unsaved and says so when the folder cannot be written', async () => {
    const blocker = path.join(userData, 'a-file');
    fs.writeFileSync(blocker, 'not a folder');
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'main' }, { localPath: blocker });
    documents.updateDoc(
      W,
      (doc) => model.applyEdit(doc, 'main.js', 'edited', doc.fiddleRev) ?? doc,
    );

    expect(await documents.saveIn(W, 'save')).toBe(false);

    expect(model.isDirty(documents.getDoc(W))).toBe(true);
    expect(messageBox).toHaveBeenCalledWith(
      W,
      expect.objectContaining({ type: 'error', message: 'saveFailed' }),
    );
  });

  it('remembers that a saved untrusted fiddle is untrusted when its folder is opened again', async () => {
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'main' });
    const gist = { kind: 'gist', owner: 'octocat', id: ID, sha: 'a'.repeat(40) } as const;
    documents.updateDoc(W, (doc) => ({
      ...doc,
      fiddle: { ...doc.fiddle, origin: gist },
    }));
    pickFolder.mockResolvedValue(folder);

    await documents.saveIn(W, 'saveAs');

    expect(documents.getStateStore().get().untrustedFolders).toEqual({ [folder]: gist });
    await documents.openFolderIn(W, folder);
    expect(documents.getFiddle(W).origin).toEqual(gist);
    expect(model.isTrusted(documents.getDoc(W))).toBe(false);
  });
});

describe('openFolderIn', () => {
  it('does not add the folder to the recent folders when the user keeps their unsaved changes', async () => {
    put({ 'main.js': 'main' });
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'main' });
    documents.updateDoc(
      W,
      (doc) => model.applyEdit(doc, 'main.js', 'edited', doc.fiddleRev) ?? doc,
    );
    confirm.mockResolvedValue(false);

    await documents.openFolderIn(W, folder);

    expect(documents.recentFolders()).toEqual([]);
    expect(documents.getFiddle(W).files['main.js']).toBe('edited');

    confirm.mockResolvedValue(true);
    await documents.openFolderIn(W, folder);
    expect(documents.recentFolders()).toEqual([folder]);
  });
});

describe('a dropped file URL', () => {
  async function setupWindow() {
    const { documents, open } = await setup();
    await open({ 'main.js': 'main' });
    const contents = new EventEmitter();
    documents.attachWindow(W, contents as never);
    const drop = (url: string) => {
      const event = { preventDefault: vi.fn() };
      contents.emit('will-navigate', event, url);
      return event;
    };
    return { documents, drop };
  }

  it('opens a dropped folder, and shows an error for a dropped file instead of opening its parent folder', async () => {
    put({ 'main.js': 'from disk' });
    const { documents, drop } = await setupWindow();

    expect(drop(pathToFileURL(folder).href).preventDefault).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(documents.getFiddle(W).files['main.js']).toBe('from disk'),
    );
    expect(messageBox).not.toHaveBeenCalled();

    // Opening the parent folder would read this.
    put({ 'main.js': 'changed on disk' });
    drop(pathToFileURL(path.join(folder, 'main.js')).href);
    await vi.waitFor(() =>
      expect(messageBox).toHaveBeenCalledWith(
        W,
        expect.objectContaining({ type: 'error' }),
      ),
    );
    expect(documents.getFiddle(W).files['main.js']).toBe('from disk');
  });

  it('refuses a URL that is not a local path, without a dialog', async () => {
    const { documents, drop } = await setupWindow();

    expect(drop('file://server/share/fiddle').preventDefault).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(messageBox).not.toHaveBeenCalled();
    expect(documents.getFiddle(W).files).toEqual({ 'main.js': 'main' });
  });
});

describe('confirmQuit', () => {
  it('asks about unsaved changes once, then keeps the window in the session and its draft as it closes', async () => {
    const { documents, model, open } = await setup();
    await documents.startDocuments();
    await open({ 'main.js': 'main' });
    const contents = new EventEmitter();
    documents.attachWindow(W, contents as never);
    documents.updateDoc(
      W,
      (doc) => model.applyEdit(doc, 'main.js', 'edited', doc.fiddleRev) ?? doc,
    );

    expect(await documents.confirmQuit()).toBe(false);
    messageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    expect(await documents.confirmQuit()).toBe(true);
    expect(messageBox).toHaveBeenCalledTimes(2);

    // `autoUpdater.quitAndInstall()` closes the windows before `before-quit`.
    contents.emit('destroyed');
    expect(
      documents
        .getStateStore()
        .get()
        .sessions.map((s) => s.windowId),
    ).toContain(W);
    await vi.waitFor(() =>
      expect(fs.readdirSync(path.join(userData, 'drafts'))).toContain(`${W}.json`),
    );
  });
});

describe('replacing the fiddle while a load is running', () => {
  it('asks again when text was typed in the meantime, and keeps it if the user says no', async () => {
    let finish!: (gist: unknown) => void;
    const loadGist = () => new Promise((resolve) => (finish = resolve));
    const { documents, model, open } = await setup({ loadGist });
    await open({ 'main.js': 'main' });

    const loading = documents.loadGistIn(W, ID);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const doc = documents.getDoc(W);
    documents.editFile(W, 'main.js', 'typed meanwhile', doc.fiddleRev);
    confirm.mockResolvedValue(false);
    finish({
      id: ID,
      owner: 'octocat',
      description: '',
      public: true,
      url: '',
      revision: 'a'.repeat(40),
      files: { 'main.js': 'from the gist' },
      origin: { kind: 'gist', owner: 'octocat', id: ID, sha: 'a'.repeat(40) },
    });
    await loading;

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(documents.getFiddle(W).files['main.js']).toBe('typed meanwhile');
    expect(model.isDirty(documents.getDoc(W))).toBe(true);
  });
});

describe('a new window', () => {
  it('opens on the bundled template rather than wait for a slow download, which the next window gets', async () => {
    const { net } = await import('electron');
    let arrive!: () => void;
    vi.mocked(net.fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          arrive = () => resolve(new Response(new Uint8Array(templateZip)));
        }),
    );
    const { documents } = await setup();
    await documents.openFiddleWindow({ windowId: W });
    expect(documents.getFiddle(W).files['main.js']).toBe('// quick start');

    arrive();
    await vi.waitFor(() =>
      expect(
        fs.existsSync(path.join(userData, 'cache', 'templates', 'minimal-repro-30-x-y')),
      ).toBe(true),
    );
    await documents.openFiddleWindow({ windowId: W2 });
    expect(documents.getFiddle(W2).files['main.js']).toBe('// fixture main');
    expect(documents.getFiddle(W).files['main.js']).toBe('// quick start');
  });
});

describe('setFiddleVersion', () => {
  it('keeps the last version picked when an earlier pick loads its template late', async () => {
    const { net } = await import('electron');
    let failDownload!: () => void;
    vi.mocked(net.fetch).mockImplementation(
      () =>
        new Promise((_, reject) => (failDownload = () => reject(new Error('offline')))),
    );
    const { documents, model } = await setup();
    await documents.openFiddleWindow({
      windowId: W,
      doc: model.createDoc(
        createFiddle({
          files: { 'main.js': 'tpl' },
          version: { kind: 'release', version: '29.0.0' },
          templateName: model.DEFAULT_TEMPLATE,
        }),
        'fiddle',
      ),
    });

    // 30 has a template to download; 31 has none, so it uses the bundled one at once.
    const slow = documents.setFiddleVersion(W, version);
    await documents.setFiddleVersion(W, { kind: 'release', version: '31.0.0' });
    await vi.waitFor(() => expect(failDownload).toBeTypeOf('function'));
    failDownload();
    await slow;

    expect(documents.getFiddle(W).version).toEqual({
      kind: 'release',
      version: '31.0.0',
    });
  });
});

describe('markPublished', () => {
  it('saves what was sent, so an edit made while publishing stays unsaved', async () => {
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'sent' });
    const sent = {
      files: { 'main.js': 'sent' },
      modules: {},
      loadRev: documents.getDoc(W).loadRev,
    };
    documents.editFile(
      W,
      'main.js',
      'typed during the upload',
      documents.getDoc(W).fiddleRev,
    );

    documents.markPublished(
      W,
      { id: ID, revision: 'b'.repeat(40), owner: 'octocat' },
      sent,
    );

    const doc = documents.getDoc(W);
    expect(doc.baseline).toEqual({ 'main.js': 'sent' });
    expect(model.isDirty(doc)).toBe(true);
    expect(doc.fiddle.source).toEqual({ gistId: ID, gistRevision: 'b'.repeat(40) });
    expect(doc.gistOwner).toBe('octocat');
  });

  it('links the gist when a file was added while publishing, and keeps the fiddle unsaved', async () => {
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'sent' });
    const sent = {
      files: { 'main.js': 'sent' },
      modules: {},
      loadRev: documents.getDoc(W).loadRev,
    };
    documents.updateDoc(W, (doc) => model.docAddFile(doc, 'extra.js'));

    documents.markPublished(W, { id: ID }, sent);

    const doc = documents.getDoc(W);
    expect(doc.fiddle.source).toEqual({ gistId: ID });
    expect(doc.baseline).toEqual({ 'main.js': 'sent' });
    expect(model.isDirty(doc)).toBe(true);
  });

  it('does not link the gist to another fiddle that took the window’s place', async () => {
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'sent' });
    const sent = {
      files: { 'main.js': 'sent' },
      modules: {},
      loadRev: documents.getDoc(W).loadRev,
    };
    documents.updateDoc(W, (doc) =>
      model.createDoc(createFiddle({ files: { 'main.js': 'other' }, version }), 'other', {
        previous: doc,
      }),
    );

    documents.markPublished(W, { id: ID }, sent);

    expect(documents.getFiddle(W).source).toEqual({});
    expect(model.isDirty(documents.getDoc(W))).toBe(false);
  });
});

describe('markGistDeleted', () => {
  it('does not unlink another fiddle that took the window’s place', async () => {
    const { documents, model, open } = await setup();
    await open({ 'main.js': 'deleted' });
    const loadRev = documents.getDoc(W).loadRev;
    documents.updateDoc(W, (doc) =>
      model.createDoc(
        createFiddle({ files: { 'main.js': 'other' }, version, source: { gistId: ID } }),
        'other',
        { previous: doc },
      ),
    );

    documents.markGistDeleted(W, loadRev);

    expect(documents.getFiddle(W).source).toEqual({ gistId: ID });
    expect(model.isDirty(documents.getDoc(W))).toBe(false);
  });
});

describe('session restore', () => {
  /** A window ID for a one-letter (hex) name. */
  const wid = (c: string) =>
    `${c.repeat(8)}-${c.repeat(4)}-4${c.repeat(3)}-8${c.repeat(3)}-${c.repeat(12)}`;
  const entry = (name: string, extra: Record<string, unknown> = {}) => ({
    windowId: wid(name),
    name,
    fiddle: {
      hidden: [],
      version,
      modules: {},
      origin: { kind: 'gist', owner: 'octocat', id: ID, sha: 'a'.repeat(40) },
      source: { gistId: ID },
      fileNames: ['main.js'],
    },
    activeFile: null,
    layout: DEFAULT_LAYOUT,
    ...extra,
  });
  const gistResult = {
    id: ID,
    owner: 'octocat',
    description: '',
    public: true,
    url: '',
    revision: 'a'.repeat(40),
    files: { 'main.js': 'from the gist' },
    origin: { kind: 'gist', owner: 'octocat', id: ID, sha: 'a'.repeat(40) },
  };
  const seed = (
    documents: Awaited<ReturnType<typeof setup>>['documents'],
    sessions: ReturnType<typeof entry>[],
  ) =>
    documents.getStateStore().set((prev) => ({ ...prev, sessions: sessions as never }));

  it('does not overwrite the session while windows are still being restored', async () => {
    let finish!: (gist: unknown) => void;
    const loadGist = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockImplementationOnce(async () => gistResult)
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const { documents } = await setup({ sessionRestore: true, loadGist });
    documents.installEarlyDocumentHandlers();
    seed(documents, [entry('a'), entry('b')]);

    const starting = documents.startDocuments();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    appHandlers.get('before-quit')!({ preventDefault: vi.fn() });
    expect(
      documents
        .getStateStore()
        .get()
        .sessions.map((s) => s.windowId),
    ).toEqual([wid('a'), wid('b')]);

    finish(gistResult);
    await starting;
  });

  it('keeps a window it could not reload in the session, and says so, instead of replacing it with a template', async () => {
    const offline = new Error('offline');
    const { FiddleError } = await import('../../shared/errors');
    const loadGist = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockResolvedValueOnce(gistResult)
      .mockRejectedValueOnce(new FiddleError('network', offline.message));
    const { documents, windows } = await setup({ sessionRestore: true, loadGist });
    documents.installEarlyDocumentHandlers();
    seed(documents, [entry('a'), entry('b')]);

    await documents.startDocuments();

    expect([...windows.keys()]).toEqual([wid('a')]);
    expect(messageBox).toHaveBeenCalledWith(
      wid('a'),
      expect.objectContaining({
        message: 'restoreFailedMessage',
        detail: expect.stringContaining('"names":"b"'),
      }),
    );
    appHandlers.get('before-quit')!({ preventDefault: vi.fn() });
    const sessions = documents.getStateStore().get().sessions;
    expect(sessions.map((s) => [s.windowId, s.failedRestores])).toEqual([
      [wid('a'), undefined],
      [wid('b'), 1],
    ]);
  });

  it('gives up on a window after three launches that could not reload it', async () => {
    const loadGist = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockRejectedValue(new Error('gone'));
    const { documents } = await setup({ sessionRestore: true, loadGist });
    documents.installEarlyDocumentHandlers();
    seed(documents, [entry('b', { failedRestores: 2 })]);

    await documents.startDocuments();
    appHandlers.get('before-quit')!({ preventDefault: vi.fn() });

    // Only the new window the app opened in its place.
    const sessions = documents.getStateStore().get().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.windowId).not.toBe(wid('b'));
  });

  it('sets aside a draft it cannot read instead of deleting it with the reloaded window', async () => {
    const loadGist = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockImplementation(async () => gistResult);
    const { documents, windows } = await setup({ sessionRestore: true, loadGist });
    seed(documents, [entry('a')]);
    const drafts = path.join(userData, 'drafts');
    fs.mkdirSync(drafts);
    fs.writeFileSync(
      path.join(drafts, `${wid('a')}.json`),
      JSON.stringify({
        schemaVersion: 1,
        windowId: wid('a'),
        savedAt: '',
        name: 'a',
        fiddle: { files: 'not a map' },
        baseline: {},
        activeFile: null,
      }),
    );

    await documents.startDocuments();

    expect([...windows.keys()]).toEqual([wid('a')]);
    await vi.waitFor(() =>
      expect(fs.readdirSync(drafts)).toEqual([
        expect.stringMatching(/^a{8}-.*\.unreadable-\d+\.json$/),
      ]),
    );
  });

  it('restores every window, in the order they were saved', async () => {
    const loadGist = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockImplementation(async () => gistResult);
    const { documents, windows } = await setup({ sessionRestore: true, loadGist });
    seed(documents, [entry('a'), entry('b'), entry('c')]);
    await documents.startDocuments();
    expect([...windows.keys()]).toEqual([wid('a'), wid('b'), wid('c')]);
    expect(documents.getFiddle(wid('c')).files['main.js']).toBe('from the gist');
  });
});
