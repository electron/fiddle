import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { GitHubClient } from '../../fiddle/github';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { initMainI18n } from '../i18n';
import type { LoadResult } from './credentials';
import type { GistDocuments, GistFiddle } from './documents-bridge';
import type { GistPrefs, PublishOptions } from './prefs';
import { gistFiles, GitHubService } from './service';

beforeAll(async () => {
  await initMainI18n(['en']);
});

const TOKEN = `ghp_${'a'.repeat(36)}`;
const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const SHA1 = '1111111111111111111111111111111111111111';
const SHA2 = '2222222222222222222222222222222222222222';

interface Call {
  method: string;
  path: string;
  body:
    | {
        files?: Record<string, { content: string } | null>;
        description?: string;
        public?: boolean;
      }
    | undefined;
}

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function gistBody(files: Record<string, string>, sha: string) {
  return {
    id: ID,
    html_url: `https://gist.github.com/${ID}`,
    owner: { login: 'octocat' },
    history: [{ version: sha }],
    files: Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, { filename: name, content }]),
    ),
  };
}

/** A tiny in-memory GitHub: one gist, created by POST and replaced by PATCH (null deletes). */
function fakeGitHub(
  options: { remote?: Record<string, string>; user?: () => Response } = {},
) {
  const calls: Call[] = [];
  let remote: Record<string, string> | undefined = options.remote;
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    if (call.path === '/user') {
      return (
        options.user?.() ??
        json({ login: 'octocat' }, 200, { 'x-oauth-scopes': 'gist, repo' })
      );
    }
    if (call.method === 'POST' && call.path === '/gists') {
      remote = Object.fromEntries(
        Object.entries(call.body!.files!).map(([n, f]) => [n, f!.content]),
      );
      return json(gistBody(remote, SHA1), 201);
    }
    if (call.path === `/gists/${ID}`) {
      if (call.method === 'GET') return json(gistBody(remote ?? {}, SHA1));
      if (call.method === 'DELETE') return new Response(null, { status: 204 });
      if (call.method === 'PATCH') {
        const next = { ...remote };
        for (const [name, file] of Object.entries(call.body!.files!)) {
          if (file === null) delete next[name];
          else next[name] = file.content;
        }
        remote = next;
        return json(gistBody(remote, SHA2));
      }
    }
    return json({ message: 'Not Found' }, 404);
  }) as typeof fetch;
  return { calls, fetchFn, remote: () => remote };
}

function fakeStore(initial: LoadResult = { kind: 'none' }) {
  return {
    kind: vi.fn(async () => 'encrypted' as const),
    load: vi.fn(async () => initial),
    save: vi.fn(async () => true),
    delete: vi.fn(async () => undefined),
  };
}

function fakeDocuments(
  fiddle: Partial<GistFiddle> = {},
): GistDocuments & { saved: unknown[]; sent: unknown[]; deleted: number } {
  const docs = {
    saved: [] as unknown[],
    sent: [] as unknown[],
    deleted: 0,
    getFiddle: async (): Promise<GistFiddle> => ({
      files: { 'main.js': 'console.log(1)', 'index.html': '<p>hi</p>' },
      name: 'My fiddle',
      versionRef: { kind: 'release', version: '43.0.0' },
      modules: { lodash: '^4.17.21' },
      source: {},
      savedNames: ['main.js', 'index.html', 'removed.css'],
      fiddleRev: 3,
      ...fiddle,
    }),
    getTemplate: async () => ({
      'main.js': '// template',
      'preload.js': '// template',
      'styles.css': 'body {}',
    }),
    markGistSaved: (_windowId: string, gist: unknown, sent: unknown) => {
      docs.saved.push(gist);
      docs.sent.push(sent);
    },
    markGistDeleted: () => {
      docs.deleted++;
    },
  };
  return docs;
}

function setup(
  options: {
    stored?: LoadResult;
    remote?: Record<string, string>;
    user?: () => Response;
    fiddle?: Partial<GistFiddle>;
    asRevision?: boolean;
  } = {},
) {
  const github = fakeGitHub({ remote: options.remote, user: options.user });
  const store = fakeStore(options.stored);
  const documents = fakeDocuments(options.fiddle);
  const prefs = memoryPrefs({ asRevision: options.asRevision ?? true });
  const logins: Array<string | undefined> = [];
  const service = new GitHubService({
    store,
    createClient: (token) => new GitHubClient({ token, fetch: github.fetchFn }),
    documents,
    prefs,
    setLogin: (login) => logins.push(login),
    log: { warn: () => undefined, error: () => undefined },
  });
  return { service, github, store, documents, prefs, logins };
}

function memoryPrefs(
  initial: PublishOptions = { asRevision: true },
): GistPrefs & { isPublic: () => boolean | undefined } {
  let isPublic: boolean | undefined;
  return {
    get: () => initial,
    setVisibility: (value) => {
      isPublic = value;
    },
    isPublic: () => isPublic,
  };
}

const stored: LoadResult = {
  kind: 'ok',
  credentials: { token: TOKEN, login: 'octocat' },
};

describe('whenReady', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles at once when init never ran', async () => {
    const { service } = setup();
    await expect(service.whenReady()).resolves.toBeUndefined();
  });

  it('waits until the stored token is restored and checked', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let answer!: () => void;
    const checked = new Promise<void>((resolve) => (answer = resolve));
    const user = () =>
      checked.then(() =>
        json({ login: 'octocat' }, 200, { 'x-oauth-scopes': 'gist' }),
      ) as unknown as Response;
    const { service, store } = setup({ stored, user });
    void service.init();
    void service.init();
    let ready = false;
    const waiting = service.whenReady().then(() => (ready = true));
    await vi.advanceTimersByTimeAsync(10);
    expect(ready).toBe(false);

    answer();
    await waiting;
    expect(service.login).toBe('octocat');
    expect(store.load).toHaveBeenCalledTimes(1);
  });

  it('stops waiting when reading the stored token hangs', async () => {
    vi.useFakeTimers();
    const { service, store } = setup({ stored });
    store.load.mockImplementation(() => new Promise<LoadResult>(() => undefined));
    void service.init();
    let ready = false;
    const waiting = service.whenReady().then(() => (ready = true));
    await vi.advanceTimersByTimeAsync(7000);
    expect(ready).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    await waiting;
  });

  it('settles when the check fails, keeping the token', async () => {
    const { service } = setup({
      stored,
      user: () => {
        throw new TypeError('fetch failed');
      },
    });
    void service.init();
    await service.whenReady();
    expect(service.login).toBe('octocat');
  });
});

describe('startup auth check', () => {
  it('does nothing without a stored token', async () => {
    const { service, github, logins } = setup();
    await service.init();
    expect(github.calls).toEqual([]);
    expect(logins).toEqual([]);
    expect(service.login).toBeUndefined();
  });

  it('signs in with a stored token GitHub accepts', async () => {
    const { service, store } = setup({ stored });
    await service.init();
    expect(service.login).toBe('octocat');
    expect(store.delete).not.toHaveBeenCalled();
  });

  it.each([401, 403])('deletes the token on a %i', async (status) => {
    const { service, store, logins } = setup({
      stored,
      user: () => json({ message: 'Bad credentials' }, status),
    });
    await service.init();
    expect(store.delete).toHaveBeenCalledOnce();
    expect(service.login).toBeUndefined();
    expect(logins.at(-1)).toBeUndefined();
  });

  it('keeps the token and the stored login when offline', async () => {
    const { service, store } = setup({
      stored,
      user: () => {
        throw new TypeError('fetch failed');
      },
    });
    await service.init();
    expect(store.delete).not.toHaveBeenCalled();
    expect(service.login).toBe('octocat');
  });

  it('keeps the token when rate limited', async () => {
    const { service, store } = setup({
      stored,
      user: () => json({ message: 'rate limit' }, 429),
    });
    await service.init();
    expect(store.delete).not.toHaveBeenCalled();
    expect(service.login).toBe('octocat');
  });

  it('does not sign out a token the user signed in with while the check was running', async () => {
    const other = `ghp_${'b'.repeat(36)}`;
    const github = fakeGitHub();
    let reject!: () => void;
    const late = new Promise<Response>(
      (resolve) => (reject = () => resolve(json({ message: 'Bad credentials' }, 401))),
    );
    const store = fakeStore(stored);
    const service = new GitHubService({
      store,
      createClient: (token) =>
        new GitHubClient({
          token,
          fetch:
            token === TOKEN ? ((() => late) as unknown as typeof fetch) : github.fetchFn,
        }),
      documents: fakeDocuments(),
      prefs: memoryPrefs(),
      setLogin: () => undefined,
      log: { warn: () => undefined, error: () => undefined },
    });
    const restoring = service.init();
    await vi.waitFor(() => expect(service.login).toBe('octocat'));
    await service.signIn(other, false);

    reject();
    await restoring;
    expect(store.delete).not.toHaveBeenCalled();
    expect(service.login).toBe('octocat');
    expect(service.client()).toBeInstanceOf(GitHubClient);
  });

  it('signs out with a notice and keeps the file when decryption fails', async () => {
    const { service, store, github } = setup({ stored: { kind: 'decrypt-failed' } });
    await service.init();
    expect(service.login).toBeUndefined();
    expect(store.delete).not.toHaveBeenCalled();
    expect(github.calls).toEqual([]);
    expect(service.takeNotice()).toBe('decrypt-failed');
    expect(service.takeNotice()).toBeUndefined();
  });
});

describe('sign-in', () => {
  it('verifies the token, stores it and publishes only the login', async () => {
    const { service, store, logins } = setup();
    expect(await service.signIn(` ${TOKEN} `, false)).toEqual({
      login: 'octocat',
      persisted: true,
    });
    expect(store.save).toHaveBeenCalledWith(
      { token: TOKEN, login: 'octocat' },
      { allowPlaintext: false },
    );
    expect(logins).toEqual(['octocat']);
  });

  it('rejects a token without the gist scope', async () => {
    const { service, store } = setup({
      user: () => json({ login: 'octocat' }, 200, { 'x-oauth-scopes': 'repo' }),
    });
    await expect(service.signIn(TOKEN, false)).rejects.toMatchObject({
      details: { reason: 'missing-scope' },
    });
    expect(store.save).not.toHaveBeenCalled();
  });

  it('signs out by deleting the token', async () => {
    const { service, store } = setup({ stored });
    await service.init();
    await service.signOut();
    expect(store.delete).toHaveBeenCalledOnce();
    expect(service.login).toBeUndefined();
  });
});

describe('publish', () => {
  it('asks for sign-in first', async () => {
    const { service } = setup();
    const error = await service
      .publish('w', { description: 'd', isPublic: false })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FiddleError);
    expect(error).toMatchObject({
      code: ErrorCode.unauthorized,
      details: { reason: 'signed-out' },
    });
  });

  it('as a revision: creates from the template, then updates with the real files', async () => {
    const { service, github, documents } = setup({ stored });
    await service.init();
    github.calls.length = 0;

    const link = await service.publish('w', { description: 'Demo', isPublic: true });

    const writes = github.calls.filter((c) => c.method !== 'GET');
    expect(writes.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /gists',
      `PATCH /gists/${ID}`,
    ]);
    const [create, update] = writes;
    expect(create!.body).toMatchObject({ description: 'Demo', public: true });
    expect(Object.keys(create!.body!.files!).sort()).toEqual([
      'main.js',
      'package.json',
      'preload.js',
      'styles.css',
    ]);
    expect(create!.body!.files!['main.js']).toEqual({ content: '// template' });
    // The update carries the real files and deletes template-only files.
    expect(update!.body!.files).toMatchObject({
      'main.js': { content: 'console.log(1)' },
      'index.html': { content: '<p>hi</p>' },
      'preload.js': null,
      'styles.css': null,
    });
    expect(github.remote()).toEqual(gistFiles(await documents.getFiddle('w')));
    expect(link).toEqual({ id: ID, url: `https://gist.github.com/${ID}` });
    expect(documents.saved).toMatchObject([
      { id: ID, owner: 'octocat', url: link.url, revision: SHA2 },
    ]);
    expect(documents.sent).toMatchObject([
      { files: { 'main.js': 'console.log(1)', 'index.html': '<p>hi</p>' }, fiddleRev: 3 },
    ]);
  });

  it('without revision: creates the gist with the real files in one step', async () => {
    const { service, github, documents } = setup({ stored, asRevision: false });
    await service.init();
    github.calls.length = 0;
    await service.publish('w', { description: 'Demo', isPublic: false });
    expect(github.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /gists']);
    expect(documents.saved).toMatchObject([{ id: ID, revision: SHA1 }]);
  });

  it('links the gist even when the second step fails, then reports the error', async () => {
    const { github, documents } = setup({ stored });
    const original = github.fetchFn;
    let patched = false;
    const client = new GitHubClient({
      token: TOKEN,
      fetch: (async (input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          patched = true;
          return json({ message: 'Server Error' }, 500);
        }
        return original(input, init);
      }) as typeof fetch,
    });
    const failing = new GitHubService({
      store: fakeStore(stored),
      createClient: () => client,
      documents,
      prefs: memoryPrefs(),
      setLogin: () => undefined,
      log: { warn: () => undefined, error: () => undefined },
    });
    await failing.init();
    await expect(
      failing.publish('w', { description: 'Demo', isPublic: false }),
    ).rejects.toMatchObject({
      code: ErrorCode.unavailable,
    });
    expect(patched).toBe(true);
    expect(documents.saved).toMatchObject([{ id: ID, revision: SHA1 }]);
    // The gist holds only the template, so that is what the fiddle counts as saved.
    expect(documents.sent).toMatchObject([
      {
        files: {
          'main.js': '// template',
          'preload.js': '// template',
          'styles.css': 'body {}',
        },
      },
    ]);
  });

  it('remembers the visibility choice', async () => {
    const { service, prefs } = setup({ stored });
    await service.init();
    await service.publish('w', { description: 'Demo', isPublic: true });
    expect(prefs.isPublic()).toBe(true);
  });

  it('adds package.json with the modules and the Electron version', () => {
    const files = gistFiles({
      files: { 'renderer.js': '' },
      name: 'My fiddle!',
      versionRef: { kind: 'release', version: '43.0.0' },
      modules: { lodash: '^4.17.21' },
      source: {},
    });
    expect(Object.keys(files)).toContain('main.js');
    expect(JSON.parse(files['package.json']!)).toMatchObject({
      name: 'my-fiddle',
      main: './main.js',
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { electron: '43.0.0' },
    });
  });

  it('sets the author from the "Package author" setting', () => {
    const fiddle = {
      files: { 'main.js': '' },
      name: 'a',
      versionRef: { kind: 'release', version: '43.0.0' } as const,
      modules: {},
      source: {},
    };
    expect(JSON.parse(gistFiles(fiddle, 'octocat')['package.json']!)).toMatchObject({
      author: 'octocat',
    });
    expect(JSON.parse(gistFiles(fiddle)['package.json']!)).not.toHaveProperty('author');
  });
});

describe('update and delete', () => {
  const loaded = { source: { gistId: ID, gistRevision: SHA1 } };

  it('update deletes remote files that were removed locally', async () => {
    const remote = {
      'main.js': 'old',
      'index.html': 'old',
      'removed.css': 'x',
      'package.json': '{}',
    };
    const { service, github, documents } = setup({ stored, remote, fiddle: loaded });
    await service.init();
    github.calls.length = 0;

    await service.update('w');

    const patch = github.calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body!.files!['removed.css']).toBeNull();
    expect(patch.body!.files!['main.js']).toEqual({ content: 'console.log(1)' });
    expect(Object.keys(github.remote()!).sort()).toEqual([
      'index.html',
      'main.js',
      'package.json',
    ]);
    expect(documents.saved).toMatchObject([{ id: ID, revision: SHA2 }]);
  });

  it('update leaves remote files the fiddle never held', async () => {
    const remote = {
      'main.js': 'old',
      'index.html': 'old',
      'removed.css': 'x',
      'README.md': 'docs',
      'logo.png': 'png',
    };
    const { service, github } = setup({ stored, remote, fiddle: loaded });
    await service.init();

    await service.update('w');

    expect(Object.keys(github.remote()!).sort()).toEqual([
      'README.md',
      'index.html',
      'logo.png',
      'main.js',
      'package.json',
    ]);
  });

  it('update needs a loaded gist', async () => {
    const { service } = setup({ stored });
    await service.init();
    await expect(service.update('w')).rejects.toMatchObject({
      code: ErrorCode.notFound,
      details: { reason: 'no-gist' },
    });
  });

  it('delete removes the gist and marks the fiddle unsaved', async () => {
    const { service, github, documents } = setup({
      stored,
      remote: { 'main.js': 'x' },
      fiddle: loaded,
    });
    await service.init();
    await service.delete('w');
    expect(
      github.calls.some((c) => c.method === 'DELETE' && c.path === `/gists/${ID}`),
    ).toBe(true);
    expect(documents.deleted).toBe(1);
  });

  it('history marks the active revision', async () => {
    // History works signed out; answer /commits directly.
    const commits = [
      {
        version: SHA2,
        committed_at: '2026-09-13T10:00:00Z',
        change_status: { additions: 3, deletions: 1, total: 4 },
      },
      {
        version: SHA1,
        committed_at: '2026-09-12T10:00:00Z',
        change_status: { additions: 10, deletions: 0, total: 10 },
      },
    ];
    const history = new GitHubService({
      store: fakeStore(),
      createClient: () =>
        new GitHubClient({ fetch: (async () => json(commits)) as typeof fetch }),
      documents: fakeDocuments(loaded),
      prefs: memoryPrefs(),
      setLogin: () => undefined,
      log: { warn: () => undefined, error: () => undefined },
    });
    const result = await history.history('w');
    expect(result.activeSha).toBe(SHA1);
    expect(result.revisions.map((r) => [r.sha, r.title])).toEqual([
      [SHA1, { key: 'created' }],
      [SHA2, { key: 'revision', n: 1 }],
    ]);
  });
});
