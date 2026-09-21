import { describe, expect, it } from 'vitest';

import { DEFAULT_ENDPOINTS } from '../shared/endpoints';
import { ErrorCode, FiddleError } from '../shared/errors';
import { GIST_MAX_FILE_BYTES, GitHubClient, isValidTokenFormat } from './github';
import { ANONYMOUS_GIST_OWNER } from './trust';

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

function json(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

async function codeOf(
  promise: Promise<unknown>,
): Promise<{ code: string; details: unknown }> {
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
  it.each([
    TOKEN,
    `gho_${'a'.repeat(36)}`,
    `ghu_${'a'.repeat(36)}`,
    `ghs_${'a'.repeat(36)}`,
    `ghr_${'a'.repeat(76)}`,
    `ghp_${'a'.repeat(40)}`,
    `github_pat_${'A'.repeat(22)}_${'b'.repeat(59)}`,
  ])('accepts %j', (token) => expect(isValidTokenFormat(token)).toBe(true));

  it.each([
    `ghp_${'a'.repeat(35)}`,
    `ghx_${'a'.repeat(36)}`,
    `github_pat_${'A'.repeat(21)}`,
    `ghp_${'a'.repeat(35)}!`,
    `ghp_${'a'.repeat(36)} and more text`,
    'ghp_',
    '',
  ])('rejects %j', (token) => expect(isValidTokenFormat(token)).toBe(false));
});

describe('auth', () => {
  it('returns the login when the token has the gist scope', async () => {
    const { fn, calls } = mockFetch(() =>
      json({ login: 'octocat' }, { headers: { 'x-oauth-scopes': 'repo, gist' } }),
    );
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    await expect(client.verifyToken()).resolves.toBe('octocat');
    expect(calls[0]!.url).toBe('https://api.github.com/user');
    expect(calls[0]!.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]!.redirect).toBe('manual');
  });

  it('refuses a bad format without a request', async () => {
    const { fn, calls } = mockFetch(() => json({}));
    const result = await codeOf(
      new GitHubClient({ token: 'nope', fetch: fn }).verifyToken(),
    );
    expect(result).toMatchObject({
      code: ErrorCode.invalidArgument,
      details: { reason: 'bad-format' },
    });
    expect(calls).toHaveLength(0);
  });

  it('reports a missing gist scope', async () => {
    const { fn } = mockFetch(() =>
      json({ login: 'octocat' }, { headers: { 'x-oauth-scopes': 'repo' } }),
    );
    const result = await codeOf(
      new GitHubClient({ token: TOKEN, fetch: fn }).verifyToken(),
    );
    expect(result).toMatchObject({
      code: ErrorCode.forbidden,
      details: { reason: 'missing-scope' },
    });
  });

  it('accepts a fine-grained token, which GitHub sends no scopes for', async () => {
    const { fn } = mockFetch(() => json({ login: 'octocat' }));
    const token = `github_pat_${'A'.repeat(22)}_${'b'.repeat(59)}`;
    await expect(new GitHubClient({ token, fetch: fn }).verifyToken()).resolves.toBe(
      'octocat',
    );
    const empty = mockFetch(() =>
      json({ login: 'octocat' }, { headers: { 'x-oauth-scopes': '' } }),
    );
    const result = await codeOf(
      new GitHubClient({ token: TOKEN, fetch: empty.fn }).verifyToken(),
    );
    expect(result).toMatchObject({ details: { reason: 'missing-scope' } });
  });

  it('reports an invalid token', async () => {
    const { fn } = mockFetch(() => json({ message: 'Bad credentials' }, { status: 401 }));
    const result = await codeOf(
      new GitHubClient({ token: TOKEN, fetch: fn }).verifyToken(),
    );
    expect(result).toMatchObject({
      code: ErrorCode.unauthorized,
      details: { reason: 'invalid-token' },
    });
  });

  it('maps 401, 403 and network failures for the startup check', async () => {
    const check = (fetchFn: typeof fetch) =>
      codeOf(new GitHubClient({ token: TOKEN, fetch: fetchFn }).getAuthenticatedUser());
    expect(
      (
        await check(
          mockFetch(() => json({ message: 'Bad credentials' }, { status: 401 })).fn,
        )
      ).code,
    ).toBe(ErrorCode.unauthorized);
    expect((await check(mockFetch(() => json({}, { status: 403 })).fn)).code).toBe(
      ErrorCode.forbidden,
    );
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect((await check(offline)).code).toBe(ErrorCode.network);
  });

  it('maps a rate-limited 403 to unavailable, so the startup check keeps the token', async () => {
    const check = (headers: Record<string, string>) =>
      codeOf(
        new GitHubClient({
          token: TOKEN,
          fetch: mockFetch(() =>
            json({ message: 'API rate limit exceeded' }, { status: 403, headers }),
          ).fn,
        }).getAuthenticatedUser(),
      );
    expect((await check({ 'x-ratelimit-remaining': '0' })).code).toBe(
      ErrorCode.unavailable,
    );
    expect((await check({ 'retry-after': '60' })).code).toBe(ErrorCode.unavailable);
    expect((await check({ 'retry-after': '60' })).details).toMatchObject({
      reason: 'rate-limited',
    });
    expect((await check({ 'x-ratelimit-remaining': '42' })).code).toBe(
      ErrorCode.forbidden,
    );
    const verify = mockFetch(() =>
      json({}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
    );
    expect(
      (await codeOf(new GitHubClient({ token: TOKEN, fetch: verify.fn }).verifyToken()))
        .code,
    ).toBe(ErrorCode.unavailable);
  });

  it('maps an abort to cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const aborting = (async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as typeof fetch;
    const client = new GitHubClient({ token: TOKEN, fetch: aborting });
    expect((await codeOf(client.getAuthenticatedUser(controller.signal))).code).toBe(
      ErrorCode.cancelled,
    );
  });

  it('needs a token for the auth check', async () => {
    const { fn } = mockFetch(() => json({}));
    expect(
      (await codeOf(new GitHubClient({ fetch: fn }).getAuthenticatedUser())).code,
    ).toBe(ErrorCode.unauthorized);
  });
});

describe('where the token goes', () => {
  const ok = () => json({ login: 'x' }, { headers: { 'x-oauth-scopes': 'gist' } });

  it('is sent to a loopback fixture server only when that is allowed (test mode)', async () => {
    const { fn, calls } = mockFetch(ok);
    const endpoints = { ...DEFAULT_ENDPOINTS, githubApi: 'http://127.0.0.1:4567/api' };
    await new GitHubClient({
      token: TOKEN,
      endpoints,
      fetch: fn,
      allowLoopbackHttp: true,
    }).getAuthenticatedUser();
    expect(calls[0]!.url).toBe('http://127.0.0.1:4567/api/user');
    expect(calls[0]!.headers.Authorization).toBe(`Bearer ${TOKEN}`);

    await new GitHubClient({ token: TOKEN, endpoints, fetch: fn }).getAuthenticatedUser();
    expect(calls[1]!.headers.Authorization).toBeUndefined();
  });

  it('fetches plain http from loopback only when that is allowed', async () => {
    const { fn } = mockFetch(() => new Response('text'));
    const url = 'http://localhost:4567/raw/main.js';
    expect((await codeOf(new GitHubClient({ fetch: fn }).fetchText(url))).code).toBe(
      ErrorCode.invalidArgument,
    );
    await expect(
      new GitHubClient({ fetch: fn, allowLoopbackHttp: true }).fetchText(url),
    ).resolves.toBe('text');
  });

  it('is never sent over plain http to other hosts', async () => {
    const { fn, calls } = mockFetch(ok);
    await new GitHubClient({
      token: TOKEN,
      endpoints: { ...DEFAULT_ENDPOINTS, githubApi: 'http://example.com' },
      fetch: fn,
    }).getAuthenticatedUser();
    expect(calls[0]!.headers.Authorization).toBeUndefined();
  });

  it('is dropped on a cross-host redirect and stays dropped', async () => {
    const { fn, calls } = mockFetch((call) => {
      if (call.url === 'https://api.github.com/user') {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://elsewhere.example/user' },
        });
      }
      if (call.url === 'https://elsewhere.example/user') {
        return new Response(null, {
          status: 307,
          headers: { location: 'https://api.github.com/user2' },
        });
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
      call.url.endsWith('/user')
        ? new Response(null, { status: 301, headers: { location: '/user-moved' } })
        : ok(),
    );
    await new GitHubClient({ token: TOKEN, fetch: fn }).getAuthenticatedUser();
    expect(calls[1]).toMatchObject({
      url: 'https://api.github.com/user-moved',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it('gives up after too many redirects', async () => {
    const { fn } = mockFetch(
      () => new Response(null, { status: 302, headers: { location: '/loop' } }),
    );
    expect(
      (await codeOf(new GitHubClient({ token: TOKEN, fetch: fn }).getAuthenticatedUser()))
        .code,
    ).toBe(ErrorCode.network);
  });
});

describe('loadGist', () => {
  it('loads a public gist signed out, fetching truncated files in full', async () => {
    const { fn, calls } = mockFetch((call) => {
      if (call.url === `https://gist.githubusercontent.com/octocat/${ID}/raw/big.js`)
        return new Response('FULL CONTENT');
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
      origin: { kind: 'gist', owner: 'octocat', id: ID, sha: SHA },
    });
    expect(calls[0]!.url).toBe(`https://api.github.com/gists/${ID}`);
    expect(calls.every((c) => c.headers.Authorization === undefined)).toBe(true);
  });

  it('sends the token to the gist raw host when signed in', async () => {
    const raw = `https://gist.githubusercontent.com/o/${ID}/raw/a.js`;
    const { fn, calls } = mockFetch((call) =>
      call.url === raw
        ? new Response('A')
        : json(gist({ 'a.js': { content: '', truncated: true, raw_url: raw } })),
    );
    await new GitHubClient({ token: TOKEN, fetch: fn }).loadGist(ID);
    expect(calls[1]).toMatchObject({
      url: raw,
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it('loads a revision', async () => {
    const other = 'f'.repeat(40);
    const { fn, calls } = mockFetch(() => json(gist({ 'main.js': { content: 'old' } })));
    const result = await new GitHubClient({ fetch: fn }).loadGist(
      ID,
      other.toUpperCase(),
    );
    expect(calls[0]!.url).toBe(`https://api.github.com/gists/${ID}/${other}`);
    expect(result.revision).toBe(other);
    expect(result.files).toEqual({ 'main.js': 'old' });
  });

  it('gives anonymous gists a placeholder owner in the origin', async () => {
    const { fn } = mockFetch(() =>
      json(gist({ 'main.js': { content: 'x' } }, { owner: null })),
    );
    const result = await new GitHubClient({ fetch: fn }).loadGist(ID);
    expect(result.owner).toBeNull();
    expect(result.origin).toEqual({
      kind: 'gist',
      owner: ANONYMOUS_GIST_OWNER,
      id: ID,
      sha: SHA,
    });
  });

  it('throws when the gist has no history', async () => {
    for (const extra of [{ history: [] }, { history: undefined }]) {
      const { fn } = mockFetch(() => json(gist({ 'main.js': { content: 'x' } }, extra)));
      const error = await codeOf(new GitHubClient({ fetch: fn }).loadGist(ID));
      expect(error).toMatchObject({
        code: ErrorCode.internal,
        details: { reason: 'no-history' },
      });
    }
  });

  it('validates the ID and revision before any request', async () => {
    const { fn, calls } = mockFetch(() => json({}));
    const client = new GitHubClient({ fetch: fn });
    expect((await codeOf(client.loadGist('nope'))).code).toBe(ErrorCode.invalidArgument);
    expect((await codeOf(client.loadGist(ID, 'abc'))).code).toBe(
      ErrorCode.invalidArgument,
    );
    expect(calls).toHaveLength(0);
  });

  it('maps a missing gist to not-found and a bad body to internal', async () => {
    expect(
      (
        await codeOf(
          new GitHubClient({
            fetch: mockFetch(() => json({}, { status: 404 })).fn,
          }).loadGist(ID),
        )
      ).code,
    ).toBe(ErrorCode.notFound);
    expect(
      (
        await codeOf(
          new GitHubClient({ fetch: mockFetch(() => json({ nope: 1 })).fn }).loadGist(ID),
        )
      ).code,
    ).toBe(ErrorCode.internal);
  });
});

describe('writing gists', () => {
  it('needs a token', async () => {
    const { fn, calls } = mockFetch(() => json({}));
    const result = await codeOf(
      new GitHubClient({ fetch: fn }).createGist({
        description: 'd',
        files: { 'a.js': 'x' },
        isPublic: false,
      }),
    );
    expect(result).toMatchObject({
      code: ErrorCode.unauthorized,
      details: { reason: 'signed-out' },
    });
    expect(calls).toHaveLength(0);
  });

  it('creates a secret or public gist', async () => {
    const { fn, calls } = mockFetch(() =>
      json(gist({ 'main.js': { content: 'x' } }), { status: 201 }),
    );
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    const result = await client.createGist({
      description: 'Electron Fiddle Gist',
      files: { 'main.js': 'x' },
      isPublic: false,
    });
    expect(result).toEqual({
      id: ID,
      url: `https://gist.github.com/${ID}`,
      owner: 'octocat',
      revision: SHA,
      files: ['main.js'],
    });
    expect(calls[0]).toMatchObject({
      url: 'https://api.github.com/gists',
      method: 'POST',
      body: {
        description: 'Electron Fiddle Gist',
        public: false,
        files: { 'main.js': { content: 'x' } },
      },
    });
    await client.createGist({
      description: 'd',
      files: { 'main.js': 'x' },
      isPublic: true,
    });
    expect(calls[1]!.body).toMatchObject({ public: true });
  });

  it('validates the description and files', async () => {
    const { fn, calls } = mockFetch(() => json(gist({})));
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    const create = (description: string, files: Record<string, string>) =>
      codeOf(client.createGist({ description, files, isPublic: false }));
    expect((await create('', { 'a.js': 'x' })).details).toMatchObject({
      reason: 'invalid-description',
    });
    expect((await create('x'.repeat(257), { 'a.js': 'x' })).details).toMatchObject({
      reason: 'invalid-description',
    });
    expect((await create('d', {})).details).toMatchObject({ reason: 'no-files' });
    const many = Object.fromEntries(
      Array.from({ length: 301 }, (_, i) => [`f${i}.js`, 'x']),
    );
    expect((await create('d', many)).details).toMatchObject({ reason: 'too-many-files' });
    expect(
      (await create('d', { 'big.js': 'x'.repeat(GIST_MAX_FILE_BYTES + 1) })).details,
    ).toMatchObject({
      reason: 'file-too-large',
    });
    expect((await create('d', { 'a/b.js': 'x' })).details).toMatchObject({
      reason: 'invalid-file-name',
    });
    expect(calls).toHaveLength(0);
    await client.createGist({
      description: 'x'.repeat(256),
      files: Object.fromEntries(Object.entries(many).slice(0, 300)),
      isPublic: false,
    });
    expect(calls).toHaveLength(1);
  });

  it('updates, deleting remote files removed locally', async () => {
    const { fn, calls } = mockFetch((call) =>
      call.method === 'GET'
        ? json(gist({ 'main.js': { content: 'a' }, 'old.css': { content: 'b' } }))
        : json(
            gist(
              { 'main.js': { content: 'new' } },
              { history: [{ version: 'b'.repeat(40) }] },
            ),
          ),
    );
    const result = await new GitHubClient({ token: TOKEN, fetch: fn }).updateGist(ID, {
      files: { 'main.js': 'new', 'add.js': 'y' },
      canDelete: () => true,
    });
    expect(calls[1]).toMatchObject({
      url: `https://api.github.com/gists/${ID}`,
      method: 'PATCH',
      body: {
        files: {
          'main.js': { content: 'new' },
          'add.js': { content: 'y' },
          'old.css': null,
        },
      },
    });
    expect(result.revision).toBe('b'.repeat(40));
  });

  it('keeps remote files the caller does not let it delete', async () => {
    const { fn, calls } = mockFetch((call) =>
      call.method === 'GET'
        ? json(
            gist({
              'main.js': { content: 'a' },
              'old.css': { content: 'b' },
              'README.md': { content: 'c' },
              'logo.png': { content: 'd' },
            }),
          )
        : json(gist({})),
    );
    await new GitHubClient({ token: TOKEN, fetch: fn }).updateGist(ID, {
      files: { 'main.js': 'new' },
      canDelete: (name) => name.endsWith('.css'),
    });
    expect(calls[1]!.body).toEqual({
      files: { 'main.js': { content: 'new' }, 'old.css': null },
    });
  });

  it('skips reading the gist when the caller knows its files', async () => {
    const { fn, calls } = mockFetch(() => json(gist({})));
    await new GitHubClient({ token: TOKEN, fetch: fn }).updateGist(ID, {
      files: { 'main.js': 'new' },
      canDelete: () => true,
      remote: ['main.js', 'template.js'],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      body: { files: { 'main.js': { content: 'new' }, 'template.js': null } },
    });
  });

  it('leaves empty files out of a new gist, since GitHub rejects them', async () => {
    const { fn, calls } = mockFetch(() => json(gist({}), { status: 201 }));
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    await client.createGist({
      description: 'd',
      files: { 'main.js': 'x', 'styles.css': '', 'blank.js': ' \n' },
      isPublic: false,
    });
    expect(calls[0]!.body).toEqual({
      description: 'd',
      public: false,
      files: { 'main.js': { content: 'x' } },
    });
    const allEmpty = await codeOf(
      client.createGist({ description: 'd', files: { 'a.js': '' }, isPublic: false }),
    );
    expect(allEmpty.details).toMatchObject({ reason: 'no-files' });
    expect(calls).toHaveLength(1);
  });

  it('deletes files that became empty on update, and never sends empty content', async () => {
    const { fn, calls } = mockFetch((call) =>
      call.method === 'GET'
        ? json(gist({ 'main.js': { content: 'a' }, 'styles.css': { content: 'b' } }))
        : json(gist({})),
    );
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    await client.updateGist(ID, {
      files: { 'main.js': 'new', 'styles.css': '', 'new.js': '' },
      canDelete: () => true,
    });
    expect(calls[1]).toMatchObject({
      method: 'PATCH',
      body: { files: { 'main.js': { content: 'new' }, 'styles.css': null } },
    });
    expect(Object.keys((calls[1]!.body as { files: object }).files).sort()).toEqual([
      'main.js',
      'styles.css',
    ]);
    const allEmpty = await codeOf(
      client.updateGist(ID, { files: { 'main.js': '' }, canDelete: () => true }),
    );
    expect(allEmpty.details).toMatchObject({ reason: 'no-files' });
    expect(calls).toHaveLength(2);
  });

  it('deletes', async () => {
    const { fn, calls } = mockFetch(() => new Response(null, { status: 204 }));
    await new GitHubClient({ token: TOKEN, fetch: fn }).deleteGist(ID);
    expect(calls[0]).toMatchObject({
      method: 'DELETE',
      url: `https://api.github.com/gists/${ID}`,
    });
    const missing = mockFetch(() => json({ message: 'Not Found' }, { status: 404 }));
    const error = await codeOf(
      new GitHubClient({ token: TOKEN, fetch: missing.fn }).deleteGist(ID),
    );
    expect(error).toMatchObject({
      code: ErrorCode.notFound,
      details: { status: 404, detail: 'Not Found' },
    });
  });
});

describe('listGistRevisions', () => {
  const commit = (
    version: string,
    additions: number,
    deletions: number,
    date = '2024-01-01T00:00:00Z',
  ) => ({
    version,
    committed_at: date,
    change_status: { total: additions + deletions, additions, deletions },
  });

  it('drops empty revisions except the first, oldest first', async () => {
    const { fn, calls } = mockFetch(() =>
      json([
        commit('d'.repeat(40), 0, 3),
        commit('c'.repeat(40), 0, 0),
        commit('b'.repeat(40), 2, 0),
        commit('a'.repeat(40), 0, 0),
      ]),
    );
    const revisions = await new GitHubClient({ fetch: fn }).listGistRevisions(ID);
    expect(calls[0]!.url).toBe(`https://api.github.com/gists/${ID}/commits?per_page=100`);
    expect(revisions.map((r) => [r.sha[0], r.additions, r.deletions])).toEqual([
      ['a', 0, 0],
      ['b', 2, 0],
      ['d', 0, 3],
    ]);
  });

  it('follows pagination', async () => {
    const next = `https://api.github.com/gists/${ID}/commits?per_page=100&page=2`;
    const { fn, calls } = mockFetch((call) =>
      call.url === next
        ? json([commit('a'.repeat(40), 1, 0)])
        : json([commit('b'.repeat(40), 1, 0)], {
            headers: { link: `<${next}>; rel="next", <${next}>; rel="last"` },
          }),
    );
    const revisions = await new GitHubClient({ fetch: fn }).listGistRevisions(ID);
    expect(calls).toHaveLength(2);
    expect(revisions.map((r) => r.sha[0])).toEqual(['a', 'b']);
  });
});

describe('repository contents', () => {
  it('lists a directory at a ref', async () => {
    const { fn, calls } = mockFetch(() =>
      json([
        {
          name: 'main.js',
          path: 'docs/fiddles/x/main.js',
          type: 'file',
          download_url: 'https://raw.githubusercontent.com/x',
        },
      ]),
    );
    const entries = await new GitHubClient({ fetch: fn }).listRepoDirectory(
      'electron',
      'electron',
      'docs/fiddles/a b',
      'v30.0.0',
    );
    expect(calls[0]!.url).toBe(
      'https://api.github.com/repos/electron/electron/contents/docs/fiddles/a%20b?ref=v30.0.0',
    );
    expect(entries).toEqual([
      {
        name: 'main.js',
        path: 'docs/fiddles/x/main.js',
        type: 'file',
        downloadUrl: 'https://raw.githubusercontent.com/x',
      },
    ]);
  });

  it('rejects a path that is not a folder', async () => {
    const { fn } = mockFetch(() => json({ name: 'main.js', type: 'file' }));
    const error = await codeOf(
      new GitHubClient({ fetch: fn }).listRepoDirectory(
        'electron',
        'electron',
        'x',
        'v1.0.0',
      ),
    );
    expect(error.details).toMatchObject({ reason: 'not-a-directory' });
  });

  it('fetches text only over https, without the token for other hosts', async () => {
    const { fn, calls } = mockFetch(() => new Response('text'));
    const client = new GitHubClient({ token: TOKEN, fetch: fn });
    await expect(
      client.fetchText('https://raw.githubusercontent.com/electron/electron/v1/main.js'),
    ).resolves.toBe('text');
    expect(calls[0]!.headers.Authorization).toBeUndefined();
    expect(
      (await codeOf(client.fetchText('http://raw.githubusercontent.com/x'))).code,
    ).toBe(ErrorCode.invalidArgument);
  });
});
