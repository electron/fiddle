/**
 * `electron-fiddle://` links, gist URLs and folders handed to the app: what the user is asked, where
 * the fiddle loads, and the sign-in offer for a gist that may be private.
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFiddle } from '../../fiddle/fiddle';
import {
  type FakeWindow,
  fakeWindow,
  flushAndRemove,
  initFakeDocuments,
} from './test-helpers';

let userData = '';
const appHandlers = new Map<string, (...args: unknown[]) => void>();
const app = {
  getPath: () => userData,
  isPackaged: false,
  getAppPath: () => userData,
  addRecentDocument: vi.fn(),
  requestSingleInstanceLock: () => true,
  on: (event: string, handler: (...args: unknown[]) => void) =>
    void appHandlers.set(event, handler),
  quit: vi.fn(),
};
const messageBox = vi.fn();
const confirm = vi.fn();
const sendWindowCommand = vi.fn();

/** The open BrowserWindows by window ID. */
const browserWindows = new Map<string, FakeWindow>();

vi.mock('electron', () => ({ app, net: { fetch: vi.fn() } }));
vi.mock('../dialogs', () => ({
  messageBox: (...args: unknown[]) => messageBox(...args),
  confirm: (...args: unknown[]) => confirm(...args),
  pickFolder: vi.fn(),
}));
vi.mock('../windows', () => ({
  getWindow: (id: string | undefined) =>
    id === undefined ? undefined : browserWindows.get(id),
  sendWindowCommand: (...args: unknown[]) => sendWindowCommand(...args),
}));
vi.mock('../i18n');
vi.mock('../test-mode', async (original) => ({
  ...(await original<typeof import('../test-mode')>()),
  getCacheRoot: () => path.join(userData, 'cache'),
}));

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const SHA = 'a'.repeat(40);
const W = '11111111-1111-4111-8111-111111111111';
const version = { kind: 'release', version: '30.0.0' } as const;
const gistLink = `electron-fiddle://gist/octocat/${ID}`;
const docsLink = 'electron-fiddle://electron/v30.0.0/docs/fiddles/quick-start';

function gistResult(files: Record<string, string> = { 'main.js': 'from the gist' }) {
  return {
    id: ID,
    owner: 'octocat',
    description: 'A demo',
    public: true,
    url: `https://gist.github.com/octocat/${ID}`,
    revision: SHA,
    files,
    origin: { kind: 'gist', owner: 'octocat', id: ID, sha: SHA },
  };
}

/** The files of `docs/fiddles/quick-start` at v30.0.0, by download URL. */
const exampleFiles: Record<string, string> = {
  'https://raw.test/main.js': '// example main',
  'https://raw.test/index.html': '<p>example</p>',
};

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-links-'));
  fs.mkdirSync(path.join(userData, 'static', 'electron-quick-start'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(userData, 'static', 'electron-quick-start', 'main.js'),
    '// quick start',
  );
  fs.writeFileSync(
    path.join(userData, 'static', 'electron-quick-start', 'renderer.js'),
    '// quick start renderer',
  );
  vi.resetModules();
  appHandlers.clear();
  browserWindows.clear();
  for (const mock of [messageBox, confirm, sendWindowCommand, app.addRecentDocument])
    mock.mockReset();
  messageBox.mockResolvedValue({ response: 1, checkboxChecked: false });
  confirm.mockResolvedValue(true);
});

afterEach(() => flushAndRemove(userData));

interface SetupOptions {
  platform?: 'darwin' | 'linux';
  /** The fake hub's `app` store and change listeners, for the sign-in retry. */
  hub?: object;
}

async function setup(options: SetupOptions = {}) {
  const documents = await import('./service');
  const model = await import('./model');
  const { FiddleError } = await import('../../shared/errors');
  const client = {
    loadGist: vi.fn<(id: string, revision?: string) => Promise<unknown>>(async () =>
      gistResult(),
    ),
    listRepoDirectory: vi.fn(async () =>
      Object.keys(exampleFiles).map((url) => ({
        name: path.posix.basename(url),
        path: `docs/fiddles/quick-start/${path.posix.basename(url)}`,
        type: 'file',
        downloadUrl: url,
      })),
    ),
    fetchText: vi.fn(async (url: string) => exampleFiles[url]!),
  };
  const onDocsExampleLoaded = vi.fn();
  const windows = initFakeDocuments(documents, {
    ...(options.platform ? { platform: options.platform } : {}),
    versions: {
      releases: () => [{ version: '30.0.0', supported: true }],
      release: (v: string) =>
        v === '30.0.0' ? { version: v, supported: true } : undefined,
    },
    github: { client: () => client },
    ...(options.hub ? { hub: options.hub } : {}),
    // Every window the service opens gets a BrowserWindow that is not shown yet.
    onCreateWindow: async (id) => {
      if (!browserWindows.has(id)) browserWindows.set(id, fakeWindow(false));
    },
    onDocsExampleLoaded,
  });
  documents.installEarlyDocumentHandlers();
  const win = fakeWindow();
  browserWindows.set(W, win);
  const contents = new EventEmitter();
  await documents.openFiddleWindow({
    windowId: W,
    doc: model.createDoc(createFiddle({ files: { 'main.js': 'mine' }, version }), 'mine'),
  });
  documents.attachWindow(W, contents as never);
  const edit = () =>
    documents.editFile(W, 'main.js', 'edited', documents.getDoc(W).fiddleRev);
  /** Hands the app a link before its windows are up, then starts it: resolves once the link is handled. */
  const openLink = async (url: string) => {
    await documents.openDropped(W, url);
    await documents.startDocuments();
  };
  const otherWindow = () => [...windows.keys()].find((id) => id !== W);
  /** An error of the service's own `FiddleError` class, which `vi.resetModules` re-creates per test. */
  const failure = (code: string, message: string) => new FiddleError(code, message);
  return {
    failure,
    documents,
    model,
    windows,
    client,
    win,
    contents,
    onDocsExampleLoaded,
    edit,
    openLink,
    otherWindow,
  };
}

describe('a gist link', () => {
  it('loads the gist into the focused window once the user confirms the revision shown', async () => {
    const { documents, client, win, openLink } = await setup();
    win.isMinimized = () => true;

    await openLink(`${gistLink}?revision=${SHA}`);

    expect(win.restore).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(
      W,
      expect.objectContaining({
        message: 'linkGistMessage',
        detail: expect.stringContaining(`detailRevision:{"sha":"${SHA}"}`),
      }),
    );
    expect(client.loadGist).toHaveBeenCalledExactlyOnceWith(ID, SHA);
    expect(documents.getFiddle(W).files['main.js']).toBe('from the gist');
    expect(documents.getFiddle(W).source).toEqual({ gistId: ID, gistRevision: SHA });
    expect(documents.getDoc(W).gistOwner).toBe('octocat');
    expect(win.setTitle).toHaveBeenLastCalledWith(documents.getDoc(W).name);
  });

  it('leaves the window alone when the user cancels the prompt', async () => {
    const { documents, client, openLink } = await setup();
    confirm.mockResolvedValue(false);

    await openLink(gistLink);

    expect(client.loadGist).toHaveBeenCalledOnce();
    expect(documents.getFiddle(W).files['main.js']).toBe('mine');
  });

  it('opens the gist in a new window when the focused one has unsaved changes', async () => {
    const { documents, windows, edit, openLink, otherWindow } = await setup();
    edit();

    await openLink(gistLink);

    expect(windows.size).toBe(2);
    expect(confirm).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ message: 'linkGistMessage' }),
    );
    expect(documents.getFiddle(W).files['main.js']).toBe('edited');
    expect(documents.getFiddle(otherWindow()!).files['main.js']).toBe('from the gist');
  });

  it('marks the window edited on macOS while the fiddle has unsaved changes', async () => {
    const { win, edit, openLink } = await setup({ platform: 'darwin' });
    await openLink(gistLink);
    expect(win.setDocumentEdited).toHaveBeenLastCalledWith(false);
    edit();
    expect(win.setDocumentEdited).toHaveBeenLastCalledWith(true);
  });

  it('shows the warnings from loading the gist in one dialog', async () => {
    const pkg = JSON.stringify({
      dependencies: { evil: 'git+https://x.test/y' },
      devDependencies: { electron: '99.0.0' },
    });
    const { client, openLink } = await setup();
    client.loadGist.mockResolvedValue(
      gistResult({ 'main.js': 'm', 'package.json': pkg }),
    );

    await openLink(gistLink);

    expect(messageBox).toHaveBeenCalledWith(
      W,
      expect.objectContaining({
        type: 'warning',
        message: 'loadWarnings',
        detail: [
          'warnVersion:{"version":"99.0.0"}',
          'warnModules:{"modules":"evil@git+https://x.test/y"}',
        ].join('\n'),
      }),
    );
  });

  it('asks before adding a file that fiddles do not usually have', async () => {
    const { documents, client, openLink } = await setup();
    client.loadGist.mockResolvedValue(
      gistResult({ 'main.js': 'm', 'keep.js': 'k', 'drop.js': 'd' }),
    );
    messageBox.mockImplementation(async (_parent, options: { message: string }) => ({
      response: options.message === 'addFileMessage:{"name":"keep.js"}' ? 0 : 1,
      checkboxChecked: false,
    }));

    await openLink(gistLink);

    expect(Object.keys(documents.getFiddle(W).files).sort()).toEqual([
      'keep.js',
      'main.js',
    ]);
  });

  it('says why the gist could not be loaded, and that the network is down rather than the raw error', async () => {
    const { documents, client, failure, openLink } = await setup();
    client.loadGist.mockRejectedValue(failure('network', 'getaddrinfo ENOTFOUND'));

    await openLink(gistLink);

    expect(messageBox).toHaveBeenCalledWith(
      W,
      expect.objectContaining({
        type: 'error',
        message: 'loadFailed',
        detail: 'offline',
      }),
    );
    expect(documents.getFiddle(W).files['main.js']).toBe('mine');
  });

  it('does not offer to sign in for a missing gist when already signed in', async () => {
    const { client, failure, openLink } = await setup({
      hub: { app: { settings: { sessionRestore: false }, githubLogin: 'me' } },
    });
    client.loadGist.mockRejectedValue(failure('not-found', 'Not Found'));

    await openLink(gistLink);

    expect(confirm).not.toHaveBeenCalled();
    expect(messageBox).toHaveBeenCalledWith(
      W,
      expect.objectContaining({ message: 'loadFailed', detail: 'Not Found' }),
    );
  });
});

describe('a gist link that may be private', () => {
  function signedOutHub() {
    const listeners = new Set<(change: { store: 'app' | 'window' }) => void>();
    const hubApp: { settings: { sessionRestore: boolean }; githubLogin?: string } = {
      settings: { sessionRestore: false },
    };
    const hub = {
      app: hubApp,
      onChange: (listener: (change: { store: 'app' | 'window' }) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const signIn = (login: string) => {
      hubApp.githubLogin = login;
      for (const listener of listeners) listener({ store: 'app' });
    };
    const notifyWindow = () => {
      for (const listener of listeners) listener({ store: 'window' });
    };
    return { hub, listeners, signIn, notifyWindow };
  }
  /** Signed out, GitHub answers Not Found for a private gist. */
  async function setupSignedOut(options: SetupOptions) {
    const result = await setup(options);
    result.client.loadGist.mockRejectedValueOnce(
      result.failure('not-found', 'Not Found'),
    );
    return result;
  }

  it('offers to sign in while signed out, and loads the gist once a login is set', async () => {
    const { hub, listeners, signIn, notifyWindow } = signedOutHub();
    const { documents, client, openLink } = await setupSignedOut({ hub });

    await openLink(gistLink);

    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      W,
      expect.objectContaining({ message: 'linkSignInMessage' }),
    );
    expect(sendWindowCommand).toHaveBeenCalledExactlyOnceWith(W, 'gist.signIn');
    notifyWindow();
    expect(client.loadGist).toHaveBeenCalledOnce();

    signIn('octocat');
    expect(listeners.size).toBe(0);
    await vi.waitFor(() =>
      expect(documents.getFiddle(W).source).toMatchObject({ gistId: ID }),
    );
    expect(client.loadGist).toHaveBeenCalledTimes(2);
  });

  it('does nothing more when the user declines to sign in', async () => {
    const { hub, listeners } = signedOutHub();
    const { openLink } = await setupSignedOut({ hub });
    confirm.mockResolvedValue(false);

    await openLink(gistLink);

    expect(sendWindowCommand).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });

  it('opens a window to sign in from when every window is closed, once that window shows', async () => {
    const { hub } = signedOutHub();
    const { documents, contents, windows } = await setupSignedOut({
      hub,
      platform: 'darwin',
    });
    await documents.startDocuments();
    contents.emit('destroyed');
    browserWindows.delete(W);

    await documents.openDropped(W, gistLink);

    await vi.waitFor(() => expect(windows.size).toBe(2));
    const opened = [...windows.keys()].find((id) => id !== W)!;
    expect(confirm).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ message: 'linkSignInMessage' }),
    );
    await vi.waitFor(() =>
      expect(browserWindows.get(opened)!.listenerCount('show')).toBe(1),
    );
    expect(sendWindowCommand).not.toHaveBeenCalled();
    browserWindows.get(opened)!.emit('show');
    expect(sendWindowCommand).toHaveBeenCalledExactlyOnceWith(opened, 'gist.signIn');
  });
});

describe('which window a link goes to', () => {
  const W2 = '22222222-2222-4222-8222-222222222222';

  it('loads in the window that last had focus', async () => {
    const { documents, model, win, openLink } = await setup();
    await documents.openFiddleWindow({
      windowId: W2,
      doc: model.createDoc(
        createFiddle({ files: { 'main.js': 'newer' }, version }),
        'newer',
      ),
    });
    win.emit('focus');

    await openLink(gistLink);

    expect(documents.getFiddle(W).files['main.js']).toBe('from the gist');
    expect(documents.getFiddle(W2).files['main.js']).toBe('newer');
  });
});

describe('an Electron docs link', () => {
  it('loads the example over the template for its version after confirming, and hands the version to the versions service', async () => {
    const { documents, client, onDocsExampleLoaded, openLink } = await setup();

    await openLink(docsLink);

    expect(confirm).toHaveBeenCalledWith(
      W,
      expect.objectContaining({
        message: 'linkDocsMessage',
        detail: expect.stringContaining('detailPath:{"path":"docs/fiddles/quick-start"}'),
      }),
    );
    expect(client.listRepoDirectory).toHaveBeenCalledWith(
      'electron',
      'electron',
      'docs/fiddles/quick-start',
      'v30.0.0',
      undefined,
    );
    const fiddle = documents.getFiddle(W);
    expect(fiddle.files).toEqual({
      'main.js': '// example main',
      'index.html': '<p>example</p>',
      'renderer.js': '// quick start renderer',
    });
    expect(fiddle.origin).toEqual({
      kind: 'electron',
      tag: 'v30.0.0',
      path: 'docs/fiddles/quick-start',
    });
    expect(fiddle.version).toEqual(version);
    expect(documents.getDoc(W).name).toBe('quick-start');
    expect(onDocsExampleLoaded).toHaveBeenCalledExactlyOnceWith(W);
  });

  it('fetches nothing when the user declines', async () => {
    const { documents, client, onDocsExampleLoaded, openLink } = await setup();
    confirm.mockResolvedValue(false);

    await openLink(docsLink);

    expect(client.listRepoDirectory).not.toHaveBeenCalled();
    expect(documents.getFiddle(W).files['main.js']).toBe('mine');
    expect(onDocsExampleLoaded).not.toHaveBeenCalled();
  });
});

describe('links the app cannot read', () => {
  it('names a malformed link, and asks for a newer Fiddle for a kind of link it does not know', async () => {
    const { documents, client } = await setup();
    await documents.openDropped(W, 'electron-fiddle://gist/not-a-gist');
    await documents.openDropped(W, 'electron-fiddle://teleport/somewhere');
    await documents.startDocuments();

    expect(messageBox.mock.calls).toEqual([
      [
        W,
        {
          type: 'error',
          message: 'linkInvalid',
          detail: 'electron-fiddle://gist/not-a-gist',
        },
      ],
      [
        W,
        {
          type: 'error',
          message: 'linkNeedsNewer',
          detail: 'electron-fiddle://teleport/somewhere',
        },
      ],
    ]);
    expect(client.loadGist).not.toHaveBeenCalled();
  });
});

describe('dropped text', () => {
  it('loads a dropped gist URL or ID straight into the window, and ignores any other text', async () => {
    const { documents, client } = await setup();

    await documents.openDropped(W, 'just some words');
    await documents.openDropped(W, `https://example.test/${ID}`);
    expect(client.loadGist).not.toHaveBeenCalled();

    await documents.openDropped(W, `  https://gist.github.com/octocat/${ID}\n`);
    expect(client.loadGist).toHaveBeenCalledWith(ID, undefined, undefined);
    expect(documents.getFiddle(W).files['main.js']).toBe('from the gist');
    expect(confirm).not.toHaveBeenCalled();

    await documents.openDropped(W, ID.toUpperCase());
    expect(client.loadGist).toHaveBeenCalledTimes(2);
  });

  it('shows the error when the dropped gist cannot be loaded', async () => {
    const { documents, client, failure } = await setup();
    client.loadGist.mockRejectedValue(failure('not-found', 'Not Found'));

    await documents.openDropped(W, `https://gist.github.com/${ID}`);

    expect(messageBox).toHaveBeenCalledWith(
      W,
      expect.objectContaining({ type: 'error', message: 'loadFailed' }),
    );
    expect(documents.getFiddle(W).files['main.js']).toBe('mine');
  });
});

describe('the OS handing the app a folder, a URL or a second launch', () => {
  const event = () => ({ preventDefault: vi.fn() });

  it('opens a folder handed over before the windows are up once they are, and later ones at once', async () => {
    const first = path.join(userData, 'first');
    const second = path.join(userData, 'second');
    for (const dir of [first, second]) {
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'main.js'), `// ${path.basename(dir)}`);
    }
    const { documents } = await setup();

    appHandlers.get('open-file')!(event(), first);
    expect(documents.getFiddle(W).files['main.js']).toBe('mine');
    await documents.startDocuments();
    expect(documents.getFiddle(W).source.localPath).toBe(first);
    expect(app.addRecentDocument).toHaveBeenCalledWith(first);

    appHandlers.get('open-file')!(event(), second);
    await vi.waitFor(() =>
      expect(documents.getFiddle(W).files['main.js']).toBe('// second'),
    );
  });

  it('takes the link a second launch was started with, and just comes forward for a launch without one', async () => {
    const { documents, client, win } = await setup();
    await documents.startDocuments();

    appHandlers.get('second-instance')!({}, ['fiddle', '--some-flag']);
    expect(win.focus).toHaveBeenCalledOnce();
    expect(client.loadGist).not.toHaveBeenCalled();

    appHandlers.get('second-instance')!({}, ['fiddle', gistLink]);
    await vi.waitFor(() =>
      expect(documents.getFiddle(W).files['main.js']).toBe('from the gist'),
    );
  });
});
