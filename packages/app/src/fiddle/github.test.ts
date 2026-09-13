import { describe, expect, it } from 'vitest';

import { ErrorCode, FiddleError } from '../shared/errors';
import { GIST_MAX_FILE_BYTES, GitHubClient, isValidTokenFormat } from './github';

const TOKEN = `ghp_${'a'.repeat(36)}`;
const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const SHA = '0123456789abcdef0123456789abcdef01234567';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  redirect: RequestInit['redirect'];
}

function mockFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      redirect: init?.redirect,
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { fn, calls };
}

function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

async function codeOf(promise: Promise<unknown>): Promise<{ code: string; details: unknown }> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(FiddleError);
    return { code: (error as FiddleError).code, details: (error as FiddleError).details };
  }
  throw new Error('expected a rejection');
}

function gist(files: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    html_url: `https://gist.github.com/${ID}`,
    description: 'desc',
    public: true,
    owner: { login: 'octocat' },
    history: [{ version: SHA }],
    files,
    ...extra,
  };
}

describe('token format', () => {
  it('accepts classic and fine-grained tokens', () => {
    expect(isValidTokenFormat(TOKEN)).toBe(true);
    expect(isValidTokenFormat(`github_pat_${'A'.repeat(22)}_${'b'.repeat(59)}`)).toBe(true);
  });

  it.each([
    `ghp_${'a'.repeat(35)}`,
    `ghp_${'a'.repeat(37)}`,
    `gho_${'a'.repeat(36)}`,
    `github_pat_${'A'.repeat(21)}_${'b'.repeat(59)}`,
    `github_pat_${'A'.repeat(22)}${'b'.repeat(60)}`,
    `ghp_${'a'.repeat(35)}!`,
    '',
  ])('rejects %j', (token) => expect(isValidTokenFormat(token)).toBe(false));
});

describe('auth', () => {
  it('returns the login when the token has the gist scope', async () => {
    const { fn, calls } = mockFetch(() => json({ login: 'octocat' }, { headers: { 'x-oauth-scopes': 'repo, gist' } }));
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    await expect(client.verifyToken()).resolves.toBe('octocat');
    expect(calls[0]!.url).toBe('https://api.github.com/user');
    expect(calls[0]!.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]!.redirect).toBe('manual');
  });

  it('refuses a bad format without a request', async () => {
    const { fn, calls } = mockFetch(() => json({}));
    const result = await codeOf(new GitHubClient({ token: 'nope', fetch: fn }).verifyToken());
    expect(result).toMatchObject({ code: ErrorCode.invalidArgument, details: { reason: 'bad-format' } });
    expect(calls).toHaveLength(0);
  });

  it('reports a missing gist scope', async () => {
    const { fn } = mockFetch(() => json({ login: 'octocat' }, { headers: { 'x-oauth-scopes': 'repo' } }));
    const result = await codeOf(new GitHubClient({ token: TOKEN, fetch: fn }).verifyToken());
    expect(result).toMatchObject({ code: ErrorCode.forbidden, details: { reason: 'missing-scope' } });
  });

  it('reports an invalid token', async () => {
    const { fn } = mockFetch(() => json({ message: 'Bad credentials' }, { status: 401 }));
    const result = await codeOf(new GitHubClient({ token: TOKEN, fetch: fn }).verifyToken());
    expect(result).toMatchObject({ code: ErrorCode.unauthorized, details: { reason: 'invalid-token' } });
  });

  it('maps 401, 403 and network failures for the startup check', async () => {
    const check = (fetchFn: typeof fetch) => codeOf(new GitHubClient({ token: TOKEN, fetch: fetchFn }).getAuthenticatedUser());
    expect((await check(mockFetch(() => json({ message: 'Bad credentials' }, { status: 401 })).fn)).code).toBe(
      ErrorCode.unauthorized,
    );
    expect((await check(mockFetch(() => json({}, { status: 403 })).fn)).code).toBe(ErrorCode.forbidden);
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect((await check(offline)).code).toBe(ErrorCode.network);
  });

  it('maps an abort to cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const aborting = (async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as typeof fetch;
    const client = new GitHubClient({ token: TOKEN, fetch: aborting });
    expect((await codeOf(client.getAuthenticatedUser(controller.signal))).code).toBe(ErrorCode.cancelled);
  });

  it('needs a token for the auth check', async () => {
    const { fn } = mockFetch(() => json({}));
    expect((await codeOf(new GitHubClient({ fetch: fn }).getAuthenticatedUser())).code).toBe(ErrorCode.unauthorized);
  });
});

describe('where the token goes', () => {
  const ok = () => json({ login: 'x' }, { headers: { 'x-oauth-scopes': 'gist' } });

  it('is sent to a loopback fixture server', async () => {
    const { fn, calls } = mockFetch(ok);
    await new GitHubClient({ token: TOKEN, apiBaseUrl: 'http://127.0.0.1:4567/api', fetch: fn }).getAuthenticatedUser();
    expect(calls[0]!.url).toBe('http://127.0.0.1:4567/api/user');
    expect(calls[0]!.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('is never sent over plain http to other hosts', async () => {
    const { fn, calls } = mockFetch(ok);
    await new GitHubClient({ token: TOKEN, apiBaseUrl: 'http://example.com', fetch: fn }).getAuthenticatedUser();
    expect(calls[0]!.headers.Authorization).toBeUndefined();
  });

  it('is dropped on a cross-host redirect and stays dropped', async () => {
    const { fn, calls } = mockFetch((call) => {
      if (call.url === 'https://api.github.com/user') {
        return new Response(null, { status: 302, headers: { location: 'https://elsewhere.example/user' } });
      }
      if (call.url === 'https://elsewhere.example/user') {
        return new Response(null, { status: 307, headers: { location: 'https://api.github.com/user2' } });
      }
      return ok();
    });
    await new GitHubClient({ token: TOKEN, fetch: fn }).getAuthenticatedUser();
    expect(calls.map((c) => [c.url, c.headers.Authorization])).toEqual([
      ['https://api.github.com/user', `Bearer ${TOKEN}`],
      ['https://elsewhere.example/user', undefined],
      ['https://api.github.com/user2', undefined],
    ]);
  });

  it('is kept on a same-origin redirect', async () => {
    const { fn, calls } = mockFetch((call) =>
      call.url.endsWith('/user') ? new Response(null, { status: 301, headers: { location: '/user-moved' } }) : ok(),
    );
    await new GitHubClient({ token: TOKEN, fetch: fn }).getAuthenticatedUser();
    expect(calls[1]).toMatchObject({ url: 'https://api.github.com/user-moved', headers: { Authorization: `Bearer ${TOKEN}` } });
  });

  it('gives up after too many redirects', async () => {
    const { fn } = mockFetch(() => new Response(null, { status: 302, headers: { location: '/loop' } }));
    expect((await codeOf(new GitHubClient({ token: TOKEN, fetch: fn }).getAuthenticatedUser())).code).toBe(ErrorCode.network);
  });
});

describe('loadGist', () => {
  it('loads a public gist signed out, fetching truncated files in full', async () => {
    const { fn, calls } = mockFetch((call) => {
      if (call.url === `https://gist.githubusercontent.com/octocat/${ID}/raw/big.js`) return new Response('FULL CONTENT');
      return json(
        gist({
          'main.js': { filename: 'main.js', content: 'main()' },
          'big.js': {
            filename: 'big.js',
            content: 'FULL',
            truncated: true,
            raw_url: `https://gist.githubusercontent.com/octocat/${ID}/raw/big.js`,
          },
          'gone.js': null,
        }),
      );
    });
    const result = await new GitHubClient({ fetch: fn }).loadGist(ID);
    expect(result).toEqual({
      id: ID,
      owner: 'octocat',
      description: 'desc',
      public: true,
      url: `https://gist.github.com/${ID}`,
      revision: SHA,
      files: { 'main.js': 'main()', 'big.js': 'FULL CONTENT' },
    });
    expect(calls[0]!.url).toBe(`https://api.github.com/gists/${ID}`);
    expect(calls.every((c) => c.headers.Authorization === undefined)).toBe(true);
  });

  it('sends the token to the gist raw host when signed in', async () => {
    const raw = `https://gist.githubusercontent.com/o/${ID}/raw/a.js`;
    const { fn, calls } = mockFetch((call) =>
      call.url === raw ? new Response('A') : json(gist({ 'a.js': { content: '', truncated: true, raw_url: raw } })),
    );
    await new GitHubClient({ token: TOKEN, fetch: fn }).loadGist(ID);
    expect(calls[1]).toMatchObject({ url: raw, headers: { Authorization: `Bearer ${TOKEN}` } });
  });

  it('loads a revision', async () => {
    const other = 'f'.repeat(40);
    const { fn, calls } = mockFetch(() => json(gist({ 'main.js': { content: 'old' } })));
    const result = await new GitHubClient({ fetch: fn }).loadGist(ID, other.toUpperCase());
    expect(calls[0]!.url).toBe(`https://api.github.com/gists/${ID}/${other}`);
    expect(result.revision).toBe(other);
    expect(result.files).toEqual({ 'main.js': 'old' });
  });

  it('validates the ID and revision before any request', async () => {
    const { fn, calls } = mockFetch(() => json({}));
    const client = new GitHubClient({ fetch: fn });
    expect((await codeOf(client.loadGist('nope'))).code).toBe(ErrorCode.invalidArgument);
    expect((await codeOf(client.loadGist(ID, 'abc'))).code).toBe(ErrorCode.invalidArgument);
    expect(calls).toHaveLength(0);
  });

  it('maps a missing gist to not-found and a bad body to internal', async () => {
    expect((await codeOf(new GitHubClient({ fetch: mockFetch(() => json({}, { status: 404 })).fn }).loadGist(ID))).code).toBe(
      ErrorCode.notFound,
    );
    expect((await codeOf(new GitHubClient({ fetch: mockFetch(() => json({ nope: 1 })).fn }).loadGist(ID))).code).toBe(
      ErrorCode.internal,
    );
  });
});

describe('writing gists', () => {
  it('needs a token', async () => {
    const { fn, calls } = mockFetch(() => json({}));
    const result = await codeOf(new GitHubClient({ fetch: fn }).createGist({ description: 'd', files: { 'a.js': 'x' }, isPublic: false }));
    expect(result).toMatchObject({ code: ErrorCode.unauthorized, details: { reason: 'signed-out' } });
    expect(calls).toHaveLength(0);
  });

  it('creates a secret or public gist', async () => {
    const { fn, calls } = mockFetch(() => json(gist({}), { status: 201 }));
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    const result = await client.createGist({ description: 'Electron Fiddle Gist', files: { 'main.js': 'x' }, isPublic: false });
    expect(result).toEqual({ id: ID, url: `https://gist.github.com/${ID}`, owner: 'octocat', revision: SHA });
    expect(calls[0]).toMatchObject({
      url: 'https://api.github.com/gists',
      method: 'POST',
      body: { description: 'Electron Fiddle Gist', public: false, files: { 'main.js': { content: 'x' } } },
    });
    await client.createGist({ description: 'd', files: { 'main.js': 'x' }, isPublic: true });
    expect(calls[1]!.body).toMatchObject({ public: true });
  });

  it('validates the description and files', async () => {
    const { fn, calls } = mockFetch(() => json(gist({})));
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    const create = (description: string, files: Record<string, string>) =>
      codeOf(client.createGist({ description, files, isPublic: false }));
    expect((await create('', { 'a.js': 'x' })).details).toMatchObject({ reason: 'invalid-description' });
    expect((await create('x'.repeat(257), { 'a.js': 'x' })).details).toMatchObject({ reason: 'invalid-description' });
    expect((await create('d', {})).details).toMatchObject({ reason: 'no-files' });
    const many = Object.fromEntries(Array.from({ length: 301 }, (_, i) => [`f${i}.js`, 'x']));
    expect((await create('d', many)).details).toMatchObject({ reason: 'too-many-files' });
    expect((await create('d', { 'big.js': 'x'.repeat(GIST_MAX_FILE_BYTES + 1) })).details).toMatchObject({
      reason: 'file-too-large',
    });
    expect((await create('d', { 'a/b.js': 'x' })).details).toMatchObject({ reason: 'invalid-file-name' });
    expect(calls).toHaveLength(0);
    await client.createGist({ description: 'x'.repeat(256), files: Object.fromEntries(Object.entries(many).slice(0, 300)), isPublic: false });
    expect(calls).toHaveLength(1);
  });

  it('updates, deleting remote files removed locally', async () => {
    const { fn, calls } = mockFetch((call) =>
      call.method === 'GET'
        ? json(gist({ 'main.js': { content: 'a' }, 'old.css': { content: 'b' } }))
        : json(gist({ 'main.js': { content: 'new' } }, { history: [{ version: 'b'.repeat(40) }] })),
    );
    const result = await new GitHubClient({ token: TOKEN, fetch: fn }).updateGist(ID, { files: { 'main.js': 'new', 'add.js': 'y' } });
    expect(calls[1]).toMatchObject({
      url: `https://api.github.com/gists/${ID}`,
      method: 'PATCH',
      body: { files: { 'main.js': { content: 'new' }, 'add.js': { content: 'y' }, 'old.css': null } },
    });
    expect(result.revision).toBe('b'.repeat(40));
  });

  it('deletes', async () => {
    const { fn, calls } = mockFetch(() => new Response(null, { status: 204 }));
    await new GitHubClient({ token: TOKEN, fetch: fn }).deleteGist(ID);
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: `https://api.github.com/gists/${ID}` });
    const missing = mockFetch(() => json({ message: 'Not Found' }, { status: 404 }));
    const error = await codeOf(new GitHubClient({ token: TOKEN, fetch: missing.fn }).deleteGist(ID));
    expect(error).toMatchObject({ code: ErrorCode.notFound, details: { status: 404, githubMessage: 'Not Found' } });
  });
});

describe('listGistRevisions', () => {
  const commit = (version: string, additions: number, deletions: number, date = '2024-01-01T00:00:00Z') => ({
    version,
    committed_at: date,
    change_status: { total: additions + deletions, additions, deletions },
  });

  it('drops empty revisions except the first, oldest first, with keyed titles', async () => {
    const { fn, calls } = mockFetch(() =>
      json([commit('d'.repeat(40), 0, 3), commit('c'.repeat(40), 0, 0), commit('b'.repeat(40), 2, 0), commit('a'.repeat(40), 0, 0)]),
    );
    const revisions = await new GitHubClient({ fetch: fn }).listGistRevisions(ID);
    expect(calls[0]!.url).toBe(`https://api.github.com/gists/${ID}/commits?per_page=100`);
    expect(revisions.map((r) => [r.sha[0], r.title, r.additions, r.deletions])).toEqual([
      ['a', { key: 'created' }, 0, 0],
      ['b', { key: 'revision', n: 1 }, 2, 0],
      ['d', { key: 'revision', n: 2 }, 0, 3],
    ]);
  });

  it('follows pagination', async () => {
    const next = `https://api.github.com/gists/${ID}/commits?per_page=100&page=2`;
    const { fn, calls } = mockFetch((call) =>
      call.url === next
        ? json([commit('a'.repeat(40), 1, 0)])
        : json([commit('b'.repeat(40), 1, 0)], { headers: { link: `<${next}>; rel="next", <${next}>; rel="last"` } }),
    );
    const revisions = await new GitHubClient({ fetch: fn }).listGistRevisions(ID);
    expect(calls).toHaveLength(2);
    expect(revisions.map((r) => r.sha[0])).toEqual(['a', 'b']);
  });
});

describe('repository contents', () => {
  it('lists a directory at a ref', async () => {
    const { fn, calls } = mockFetch(() =>
      json([{ name: 'main.js', path: 'docs/fiddles/x/main.js', type: 'file', download_url: 'https://raw.githubusercontent.com/x' }]),
    );
    const entries = await new GitHubClient({ fetch: fn }).listRepoDirectory('electron', 'electron', 'docs/fiddles/a b', 'v30.0.0');
    expect(calls[0]!.url).toBe('https://api.github.com/repos/electron/electron/contents/docs/fiddles/a%20b?ref=v30.0.0');
    expect(entries).toEqual([
      { name: 'main.js', path: 'docs/fiddles/x/main.js', type: 'file', downloadUrl: 'https://raw.githubusercontent.com/x' },
    ]);
  });

  it('rejects a path that is not a folder', async () => {
    const { fn } = mockFetch(() => json({ name: 'main.js', type: 'file' }));
    const error = await codeOf(new GitHubClient({ fetch: fn }).listRepoDirectory('electron', 'electron', 'x', 'v1.0.0'));
    expect(error.details).toMatchObject({ reason: 'not-a-directory' });
  });

  it('fetches text only over https, without the token for other hosts', async () => {
    const { fn, calls } = mockFetch(() => new Response('text'));
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    await expect(client.fetchText('https://raw.githubusercontent.com/electron/electron/v1/main.js')).resolves.toBe('text');
    expect(calls[0]!.headers.Authorization).toBeUndefined();
    expect((await codeOf(client.fetchText('http://raw.githubusercontent.com/x'))).code).toBe(ErrorCode.invalidArgument);
  });
});
