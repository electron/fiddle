/** The CLI's command glue: how a fiddle spec and `--module` are read, the release list and gist commands, and the error code of each refusal. */
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Installer } from '@electron/fiddle-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_GIST_DESCRIPTION } from '../../fiddle/github';
import { DEFAULT_ENDPOINTS } from '../../shared/endpoints';
import { ErrorCode } from '../../shared/errors';
import { descriptors } from './descriptors';
import { CliErrorCode, Reporter } from './output';

const paths = vi.hoisted(() => ({ cache: '' }));
vi.mock('../test-mode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../test-mode')>()),
  getCacheRoot: () => paths.cache,
}));
vi.mock('electron', () => ({
  app: { getSystemLocale: () => 'en-US' },
  net: { fetch: vi.fn() },
}));
vi.mock('../i18n', () => ({
  tm: () => (key: string, values?: Record<string, string>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));
vi.mock('../documents/service', async () => {
  const { fileURLToPath } = await import('node:url');
  return {
    appTemplateLoader: vi.fn(),
    staticDir: () => fileURLToPath(new URL('../../../static', import.meta.url)),
  };
});
vi.mock('../run/service', () => ({ PM_INSTALL_URLS: { npm: '', yarn: '' } }));
// No login shell or package manager: package and make stop right after the trust check instead of spawning either.
vi.mock('../../fiddle/modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../fiddle/modules')>()),
  loadLoginShellPath: async () => undefined,
  findPackageManager: async () => null,
}));
vi.mock('../packaging/service', () => ({
  forgeOptionsFor: vi.fn(),
  forgeProject: vi.fn(),
  runForgeTask: vi.fn(),
}));

const { net } = await import('electron');
const { appTemplateLoader } = await import('../documents/service');
const { runCommand, withModules } = await import('./commands');

let dir: string;
let previousToken: string | undefined;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'fiddle-cli-'));
  previousToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  paths.cache = path.join(dir, 'cache');
});
afterEach(async () => {
  vi.unstubAllEnvs(); // here, so a timed-out test can't leave TMPDIR pointing at the deleted folder
  if (previousToken !== undefined) process.env.GITHUB_TOKEN = previousToken;
  else delete process.env.GITHUB_TOKEN;
  await rm(dir, { recursive: true, force: true });
});

/** A release list newer than the bundled snapshot, so the cache wins over it. 96 is the fourth-newest major: obsolete. */
const RELEASES = [
  { version: '100.0.0-nightly.20990104', date: '2099-01-04', node: '30.1.0' },
  { version: '100.0.0-beta.1', date: '2099-01-03', node: '30.1.0' },
  { version: '99.1.0', date: '2099-01-02', node: '30.0.0' },
  { version: '99.0.0', date: '2099-01-01', node: '30.0.0' },
  { version: '98.0.0', date: '2098-06-01', node: '29.0.0' },
  { version: '97.0.0', date: '2098-01-01', node: '28.0.0' },
  { version: '96.0.0', date: '2097-06-01', node: '27.0.0' },
];

/** Makes `list` the cached release list the CLI starts with. */
async function cacheReleases(list: readonly object[] = RELEASES): Promise<void> {
  await mkdir(paths.cache, { recursive: true });
  await writeFile(path.join(paths.cache, 'releases.json'), JSON.stringify(list));
}

/** An installed release: its executable in the cache, empty. */
async function fakeInstall(version: string): Promise<string> {
  const exec = Installer.getExecPath(path.join(paths.cache, 'electron', version));
  await mkdir(path.dirname(exec), { recursive: true });
  await writeFile(exec, '');
  return exec;
}

interface Request {
  method: string;
  url: URL;
  auth: string | undefined;
  body: unknown;
}

/** Answers `net.fetch` with `handler`, recording each request. No answer is a 404. */
function serve(
  handler: (request: Request) => Response | undefined | Promise<Response | undefined>,
): Request[] {
  const requests: Request[] = [];
  vi.mocked(net.fetch).mockImplementation(async (input, init) => {
    const headers = new Headers(init?.headers);
    const request: Request = {
      method: init?.method ?? 'GET',
      url: new URL(typeof input === 'string' ? input : input.url),
      auth: headers.get('authorization') ?? undefined,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);
    return (await handler(request)) ?? new Response('{}', { status: 404 });
  });
  return requests;
}

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const SHA = '1'.repeat(40);
const gistFile = (name: string, content: string) => ({
  [name]: { filename: name, content },
});
const gist = {
  id: ID,
  html_url: `https://gist.github.com/octocat/${ID}`,
  owner: { login: 'octocat' },
  files: gistFile('main.js', 'console.log(1)'),
  history: [{ version: SHA }],
};

const loaded = (modules: Record<string, string> = {}) =>
  ({ fiddle: { modules } }) as never;

describe('withModules', () => {
  it('adds each --module, `latest` when it has no version', () => {
    expect(
      withModules(loaded({ a: '1.0.0' }), ['lodash', 'react@19.0.0', 'left-pad@^1.3.0']),
    ).toEqual({
      a: '1.0.0',
      lodash: 'latest',
      react: '19.0.0',
      'left-pad': '^1.3.0',
    });
  });

  it('keeps the whole name of a scoped package, whose last @ is at index 0', () => {
    expect(withModules(loaded(), ['@types/node', '@types/node@20.0.0'])).toEqual({
      '@types/node': '20.0.0',
    });
    expect(withModules(loaded(), ['@types/node'])).toEqual({ '@types/node': 'latest' });
  });

  it.each([
    '-g',
    'a b',
    'x@git+https://example.com/x.git',
    'x@file:../x',
    'x@',
    '../x',
    'x@npm:y',
  ])('refuses %j', (spec) => {
    expect(() => withModules(loaded(), [spec])).toThrowError(
      expect.objectContaining({ code: ErrorCode.invalidArgument }),
    );
  });
});

describe('runCommand', () => {
  type Id = Parameters<typeof runCommand>[0];
  interface Event {
    type: string;
    level?: string;
    text?: string;
    stream?: string;
    ok?: boolean;
    data?: Record<string, unknown>;
  }

  /** Runs with `--json`: the events on stdout, and the error code if it failed. */
  function run(id: Id, input: Record<string, unknown>) {
    const lines: string[] = [];
    const reporter = new Reporter(true, id, {
      stdout: (text) => lines.push(text),
      stderr: () => undefined,
    });
    const events = () => lines.map((line) => JSON.parse(line) as Event);
    return runCommand(id, input, { reporter, signal: new AbortController().signal }).then(
      () => ({ code: undefined, events: events() }),
      (error: { code: string }) => ({ code: error.code, events: events() }),
    );
  }

  /** Runs without `--json`: what people read on stdout and stderr. */
  async function runPlain(id: Id, input: Record<string, unknown>) {
    const out = { stdout: '', stderr: '' };
    const reporter = new Reporter(false, id, {
      stdout: (text) => (out.stdout += text),
      stderr: (text) => (out.stderr += text),
    });
    await runCommand(id, input, { reporter, signal: new AbortController().signal });
    return out;
  }

  const parse = (id: Id, input: Record<string, unknown>) =>
    descriptors[id].input.parse(input) as Record<string, unknown>;

  const exportInput = (fiddle: string) => ({
    fiddle,
    out: path.join(dir, 'out'),
    forge: false,
  });

  it.each([
    ['electron:v30.0.0', 'no path after the tag'],
    ['electron:v30.0.0/', 'an empty path'],
    ['electron:/docs/fiddles/x', 'no tag'],
  ])('refuses %j (%s) before any request is made', async (spec) => {
    const result = await run('export', exportInput(spec));
    expect(result.code).toBe(ErrorCode.invalidArgument);
    expect(net.fetch).not.toHaveBeenCalled();
  });

  it.each(['example:no-such-example', 'missing-folder'])(
    'reports %s as not found',
    async (spec) => {
      const fiddle = spec === 'missing-folder' ? path.join(dir, spec) : spec;
      expect((await run('export', exportInput(fiddle))).code).toBe(ErrorCode.notFound);
    },
  );

  it('exports a folder with a valid package name and without the files it never had', async () => {
    const source = path.join(dir, 'My Fiddle');
    await mkdir(source);
    await writeFile(path.join(source, 'main.js'), 'console.log(1)');
    await writeFile(path.join(source, 'README.md'), 'not part of a fiddle');
    const result = await run('export', exportInput(source));
    expect(result.code).toBeUndefined();
    const out = path.join(dir, 'out');
    expect((await readdir(out)).filter((name) => !name.startsWith('.')).sort()).toEqual([
      'main.js',
      'package.json',
    ]);
    expect(
      JSON.parse(await readFile(path.join(out, 'package.json'), 'utf8')),
    ).toMatchObject({ name: 'my-fiddle' });
    expect(result.events.at(-1)).toMatchObject({
      type: 'result',
      ok: true,
      data: { files: ['main.js', 'package.json'] },
    });
  });

  it('exports a bundled example on the newest stable release that runs here', async () => {
    await cacheReleases();
    const result = await run('export', {
      ...exportInput('example:clipboard'),
      forge: true,
    });
    expect(result).toMatchObject({ code: undefined });
    expect(result.events.at(-1)?.data).toMatchObject({ name: 'Clipboard' });
    expect(
      JSON.parse(await readFile(path.join(dir, 'out', 'package.json'), 'utf8')),
    ).toMatchObject({ devDependencies: { electron: '99.1.0' } });
    const { forgeOptionsFor } = await import('../packaging/service');
    expect(forgeOptionsFor).toHaveBeenCalledWith(
      expect.objectContaining({ release: '99.1.0' }),
    );
  });

  it('exports electron:<tag>/<path> laid over the template for the tag’s version', async () => {
    await cacheReleases();
    const template = { 'main.js': '// template main', 'index.html': '<p>template</p>' };
    const getTemplate = vi.fn(async () => template);
    vi.mocked(appTemplateLoader).mockReturnValue({ getTemplate } as never);
    const raw =
      'https://raw.githubusercontent.com/electron/electron/v99.0.0/docs/fiddles/x';
    const requests = serve(({ url }) => {
      if (url.pathname === '/repos/electron/electron/contents/docs/fiddles/x')
        return Response.json([
          {
            name: 'main.js',
            path: 'docs/fiddles/x/main.js',
            type: 'file',
            download_url: `${raw}/main.js`,
          },
          {
            name: 'README.md',
            path: 'docs/fiddles/x/README.md',
            type: 'file',
            download_url: `${raw}/README.md`,
          },
        ]);
      if (url.href === `${raw}/main.js`) return new Response('// example main');
      return undefined;
    });

    const result = await run('export', exportInput('electron:v99.0.0/docs/fiddles/x'));

    expect(result).toMatchObject({ code: undefined });
    expect(result.events.at(-1)?.data).toMatchObject({
      name: 'x',
      files: ['index.html', 'main.js', 'package.json'],
    });
    expect(requests[0]?.url.searchParams.get('ref')).toBe('v99.0.0');
    expect(getTemplate).toHaveBeenCalledWith('99.0.0');
    expect(await readFile(path.join(dir, 'out', 'main.js'), 'utf8')).toBe(
      '// example main',
    );
    expect(await readFile(path.join(dir, 'out', 'index.html'), 'utf8')).toBe(
      '<p>template</p>',
    );
    // The template loader is told which majors have a stable release, so it can pick a branch.
    const { isReleasedMajor } = vi.mocked(appTemplateLoader).mock.calls[0]![0];
    expect([isReleasedMajor(99), isReleasedMajor(100)]).toEqual([true, false]);
  });

  describe('the release list', () => {
    const listed = (events: Event[]) =>
      (events.at(-1)?.data?.versions as { version: string; channel: string }[]).map(
        (v) => `${v.version} ${v.channel}`,
      );

    it('is refreshed by versions list and cached, and shows stable and beta releases that aren’t obsolete', async () => {
      const requests = serve(() => new Response(JSON.stringify(RELEASES)));
      const result = await run('versions list', parse('versions list', {}));
      expect(result.code).toBeUndefined();
      expect(listed(result.events)).toEqual([
        '100.0.0-beta.1 beta',
        '99.1.0 stable',
        '99.0.0 stable',
        '98.0.0 stable',
        '97.0.0 stable',
      ]);
      expect(requests.map((r) => r.url.href)).toEqual([DEFAULT_ENDPOINTS.releasesJson]);
      expect(
        JSON.parse(await readFile(path.join(paths.cache, 'releases.json'), 'utf8')),
      ).toEqual(RELEASES);
    });

    it('falls back to the cached list when the refresh fails', async () => {
      await cacheReleases();
      serve(() => new Response('bad gateway', { status: 502 }));
      const result = await run(
        'versions list',
        parse('versions list', { channel: ['nightly'], obsolete: true }),
      );
      expect(listed(result.events)).toEqual(['100.0.0-nightly.20990104 nightly']);
    });

    it('prints one row per version, marking installed and obsolete ones', async () => {
      await cacheReleases();
      await fakeInstall('96.0.0');
      vi.mocked(net.fetch).mockRejectedValue(new Error('offline'));
      const { stdout } = await runPlain(
        'versions list',
        parse('versions list', { channel: ['stable'], obsolete: true }),
      );
      expect(stdout.split('\n').filter(Boolean)).toEqual([
        '99.1.0  stable   2099-01-02',
        '99.0.0  stable   2099-01-01',
        '98.0.0  stable   2098-06-01',
        '97.0.0  stable   2098-01-01',
        '96.0.0  stable   2097-06-01  stateInstalled  stateObsolete',
      ]);
      const none = await runPlain(
        'versions list',
        parse('versions list', { channel: [] }),
      );
      expect(none.stdout).toBe('resultNoVersions\n');
    });

    it('is refreshed once for a version the cached list lacks, which is then reported unknown', async () => {
      await cacheReleases();
      const requests = serve(() => new Response(JSON.stringify(RELEASES)));
      const result = await run(
        'versions download',
        parse('versions download', { version: '1.2.3' }),
      );
      expect(result.code).toBe(ErrorCode.notFound);
      expect(requests).toHaveLength(1);
    });

    it('refuses a release this machine can’t run', async () => {
      // macOS on Apple silicon runs Electron 11 and later.
      await cacheReleases([...RELEASES, { version: '10.0.0', date: '2020-08-24' }]);
      const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
      const arch = Object.getOwnPropertyDescriptor(process, 'arch')!;
      Object.defineProperty(process, 'platform', { ...platform, value: 'darwin' });
      Object.defineProperty(process, 'arch', { ...arch, value: 'arm64' });
      try {
        const result = await run(
          'versions download',
          parse('versions download', { version: 'v10.0.0' }),
        );
        expect(result.code).toBe(ErrorCode.unavailable);
      } finally {
        Object.defineProperty(process, 'platform', platform);
        Object.defineProperty(process, 'arch', arch);
      }
    });
  });

  describe('an installed version', () => {
    it('is what versions download returns, without a download', async () => {
      await cacheReleases();
      const exec = await fakeInstall('99.0.0');
      const result = await run(
        'versions download',
        parse('versions download', { version: 'v99.0.0' }),
      );
      expect(result.events.at(-1)).toMatchObject({
        ok: true,
        data: { version: '99.0.0', path: exec },
      });
      expect(net.fetch).not.toHaveBeenCalled();
    });

    it('is deleted by versions remove', async () => {
      const exec = await fakeInstall('99.0.0');
      const result = await run(
        'versions remove',
        parse('versions remove', { version: '99.0.0' }),
      );
      expect(result.events.at(-1)).toMatchObject({
        ok: true,
        data: { version: '99.0.0' },
      });
      expect(existsSync(path.dirname(exec))).toBe(false);
    });
  });

  describe('a remote fiddle', () => {
    const isTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    beforeEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
      vi.mocked(net.fetch).mockImplementation(async () => Response.json(gist));
    });
    afterEach(() => {
      if (isTTY) Object.defineProperty(process.stdin, 'isTTY', isTTY);
      else delete (process.stdin as { isTTY?: boolean }).isTTY;
    });

    it('keeps the Electron version a gist asks for when the cached release list predates it', async () => {
      const pkg = JSON.stringify({ devDependencies: { electron: '999.0.0' } });
      vi.mocked(net.fetch).mockImplementation(async () =>
        Response.json({
          ...gist,
          files: { ...gist.files, ...gistFile('package.json', pkg) },
        }),
      );
      expect((await run('export', exportInput(ID))).code).toBeUndefined();
      expect(
        JSON.parse(await readFile(path.join(dir, 'out', 'package.json'), 'utf8')),
      ).toMatchObject({ devDependencies: { electron: '999.0.0' } });
    });

    const remoteInput = (id: 'run' | 'bisect' | 'package' | 'make', trust: boolean) =>
      parse(id, { fiddle: ID, good: '30.0.0', bad: '31.0.0', trust });

    it.each(['run', 'bisect', 'package', 'make'] as const)(
      'is refused by %s without --trust, and never starts the forge task',
      async (id) => {
        const result = await run(id, remoteInput(id, false));
        expect(result.code).toBe(CliErrorCode.untrusted);
        const { runForgeTask } = await import('../packaging/service');
        expect(runForgeTask).not.toHaveBeenCalled();
      },
    );

    it.each(['run', 'bisect', 'package', 'make'] as const)(
      'gets past the trust check in %s with --trust',
      async (id) => {
        // What comes next (a build, a download) may leave files: keep them in the test's folder.
        for (const key of ['TMPDIR', 'TEMP', 'TMP']) vi.stubEnv(key, dir);
        expect((await run(id, remoteInput(id, true))).code).not.toBe(
          CliErrorCode.untrusted,
        );
      },
    );
  });

  describe('gist load', () => {
    it('writes a gist revision to a folder, keeping unusual files and warning about what its package.json got wrong', async () => {
      const pkg = JSON.stringify({
        devDependencies: { electron: 'latest' },
        dependencies: { lodash: '^4.0.0', evil: 'file:../evil' },
      });
      const requests = serve(() =>
        Response.json({
          ...gist,
          files: {
            ...gist.files,
            ...gistFile('helpers.js', '// helpers'),
            ...gistFile('package.json', pkg),
          },
        }),
      );
      const out = path.join(dir, 'out');
      const result = await run(
        'gist load',
        parse('gist load', { id: gist.html_url, revision: SHA, out }),
      );

      expect(result.code).toBeUndefined();
      expect(requests.map((r) => r.url.pathname)).toEqual([`/gists/${ID}/${SHA}`]);
      expect(result.events.at(-1)?.data).toEqual({
        id: ID,
        revision: SHA,
        owner: 'octocat',
        dir: out,
        files: ['helpers.js', 'main.js', 'package.json'],
      });
      expect(result.events.filter((e) => e.level === 'warn').map((e) => e.text)).toEqual([
        'warnUnusableVersion {"version":"latest"}',
        'warnRejectedModules {"modules":"evil"}',
      ]);
      expect(
        JSON.parse(await readFile(path.join(out, 'package.json'), 'utf8')),
      ).toMatchObject({ dependencies: { lodash: '^4.0.0' } });
    });

    it('warns about a package.json that isn’t JSON and loads the rest', async () => {
      serve(() =>
        Response.json({
          ...gist,
          files: { ...gist.files, ...gistFile('package.json', '{') },
        }),
      );
      const result = await run(
        'gist load',
        parse('gist load', { id: ID, out: path.join(dir, 'out') }),
      );
      expect(result.code).toBeUndefined();
      expect(result.events.find((e) => e.level === 'warn')?.text).toBe(
        'warnInvalidPackageJson',
      );
    });

    it('refuses something that holds no gist ID', async () => {
      expect(
        (await run('gist load', parse('gist load', { id: 'octocat', out: dir }))).code,
      ).toBe(ErrorCode.invalidArgument);
    });
  });

  it('lists a gist’s revisions oldest first, without a token', async () => {
    const commit = (version: string, day: number, additions: number) => ({
      version,
      committed_at: `2099-01-0${day}T00:00:00Z`,
      change_status: { additions, deletions: 0, total: additions },
    });
    const requests = serve(() =>
      Response.json([
        commit('c'.repeat(40), 3, 2),
        commit('b'.repeat(40), 2, 0),
        commit(SHA, 1, 5),
      ]),
    );
    const { stdout } = await runPlain('gist history', parse('gist history', { id: ID }));
    expect(stdout).toBe(
      [
        `${SHA}  2099-01-01T00:00:00Z  resultRevisionCreated  +5 -0`,
        `${'c'.repeat(40)}  2099-01-03T00:00:00Z  resultRevisionN {"n":1}  +2 -0`,
        '',
      ].join('\n'),
    );
    expect(requests[0]).toMatchObject({ auth: undefined });
    expect(requests[0]?.url.pathname).toBe(`/gists/${ID}/commits`);
  });

  it('needs GITHUB_TOKEN to write a gist, and never uses the app’s stored token', async () => {
    const result = await run('gist delete', { id: ID });
    expect(result.code).toBe(ErrorCode.unauthorized);
    expect(
      (await run('gist publish', { dir: path.join(dir, 'missing'), public: false })).code,
    ).toBe(ErrorCode.unauthorized);
    const invalid = await run('gist history', { id: 'not a gist' });
    expect(invalid.code).toBe(ErrorCode.invalidArgument);
  });

  describe('with GITHUB_TOKEN', () => {
    let folder: string;
    beforeEach(async () => {
      process.env.GITHUB_TOKEN = 'ghp_test';
      folder = path.join(dir, 'my-fiddle');
      await mkdir(folder);
      await writeFile(path.join(folder, 'main.js'), 'console.log(2)');
      await cacheReleases();
    });

    const written = {
      ...gist,
      files: { ...gist.files, ...gistFile('package.json', '{}') },
    };

    it('publishes a folder as a revision on top of the template, sending the token', async () => {
      const getTemplate = vi.fn(async () => ({
        'main.js': '// template',
        'index.html': '',
      }));
      vi.mocked(appTemplateLoader).mockReturnValue({ getTemplate } as never);
      const requests = serve(({ method }) =>
        method === 'POST' || method === 'PATCH' ? Response.json(written) : undefined,
      );
      const result = await run(
        'gist publish',
        parse('gist publish', { dir: folder, public: true }),
      );

      expect(result.events.at(-1)).toMatchObject({
        ok: true,
        data: { id: ID, url: gist.html_url, revision: SHA },
      });
      expect(requests.map((r) => `${r.method} ${r.url.pathname} ${r.auth}`)).toEqual([
        'POST /gists Bearer ghp_test',
        `PATCH /gists/${ID} Bearer ghp_test`,
      ]);
      // First the template with the fiddle's package.json, then the fiddle's own files over it.
      expect(requests[0]?.body).toMatchObject({
        description: DEFAULT_GIST_DESCRIPTION,
        public: true,
        files: { 'main.js': { content: '// template' } },
      });
      expect(requests[1]?.body).toMatchObject({
        files: { 'main.js': { content: 'console.log(2)' } },
      });
      const packageJson = (
        requests[1]?.body as { files: Record<string, { content: string }> }
      ).files['package.json']!.content;
      expect(JSON.parse(packageJson)).toMatchObject({
        name: 'my-fiddle',
        devDependencies: { electron: '99.1.0' },
      });
      // The folder's fiddle has no version of its own, so the template is the default version's.
      expect(getTemplate).toHaveBeenCalledWith('99.1.0');
    });

    it('names the half-made gist when writing the files over the template fails', async () => {
      vi.mocked(appTemplateLoader).mockReturnValue({
        getTemplate: async () => ({ 'main.js': '//' }),
      } as never);
      serve(({ method }) =>
        method === 'POST'
          ? Response.json(written)
          : Response.json({ message: 'Validation failed' }, { status: 422 }),
      );
      const result = await run(
        'gist publish',
        parse('gist publish', { dir: folder, description: 'Mine' }),
      );
      expect(result.code).toBe(ErrorCode.invalidArgument);
      expect(result.events.find((e) => e.level === 'warn')?.text).toBe(
        `warnGistPartial ${JSON.stringify({ url: gist.html_url })}`,
      );
    });

    it('reports a folder that isn’t there as not found', async () => {
      const result = await run(
        'gist publish',
        parse('gist publish', { dir: path.join(dir, 'nope') }),
      );
      expect(result.code).toBe(ErrorCode.notFound);
      expect(net.fetch).not.toHaveBeenCalled();
    });

    it('updates a gist with the folder’s files, deleting only fiddle files the folder no longer has', async () => {
      const remote = {
        ...gist,
        files: {
          ...gist.files,
          ...gistFile('renderer.js', '//'),
          ...gistFile('README.md', 'docs'),
          ...gistFile('screenshot.png', ''),
        },
      };
      const requests = serve(({ method }) =>
        Response.json(method === 'GET' ? remote : written),
      );
      const result = await run(
        'gist update',
        parse('gist update', { id: ID, dir: folder }),
      );

      expect(result.events.at(-1)).toMatchObject({
        ok: true,
        data: { id: ID, revision: SHA },
      });
      const patch = requests.find((r) => r.method === 'PATCH');
      expect(patch?.auth).toBe('Bearer ghp_test');
      const files = (patch?.body as { files: Record<string, unknown> }).files;
      expect(Object.keys(files).sort()).toEqual([
        'main.js',
        'package.json',
        'renderer.js',
      ]);
      expect(files['renderer.js']).toBeNull();
    });

    it('deletes a gist', async () => {
      const requests = serve(() => new Response(null, { status: 204 }));
      const result = await run('gist delete', parse('gist delete', { id: ID }));
      expect(result.events.at(-1)).toMatchObject({ ok: true, data: { id: ID } });
      expect(requests.map((r) => `${r.method} ${r.url.pathname}`)).toEqual([
        `DELETE /gists/${ID}`,
      ]);
    });
  });
});
