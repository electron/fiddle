/** The CLI's command glue: how a fiddle spec and `--module` are read, and the error code of each refusal. */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('../documents/service', () => ({
  appTemplateLoader: vi.fn(),
  staticDir: () => '/nonexistent/static',
}));
vi.mock('../run/service', () => ({ PM_INSTALL_URLS: { npm: '', yarn: '' } }));
vi.mock('../packaging/service', () => ({
  forgeOptionsFor: vi.fn(),
  forgeProject: vi.fn(),
  runForgeTask: vi.fn(),
}));

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
  if (previousToken !== undefined) process.env.GITHUB_TOKEN = previousToken;
  await rm(dir, { recursive: true, force: true });
});

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
  function run(id: Parameters<typeof runCommand>[0], input: Record<string, unknown>) {
    const lines: string[] = [];
    const reporter = new Reporter(true, id, {
      stdout: (text) => lines.push(text),
      stderr: () => undefined,
    });
    return runCommand(id, input, { reporter, signal: new AbortController().signal }).then(
      () => ({ code: undefined, lines }),
      (error: { code: string }) => ({ code: error.code, lines }),
    );
  }

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
    expect(vi.mocked((await import('electron')).net.fetch)).not.toHaveBeenCalled();
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
    const events = result.lines.map(
      (line) =>
        JSON.parse(line) as { type: string; ok?: boolean; data?: { files: string[] } },
    );
    expect(events.at(-1)).toMatchObject({
      type: 'result',
      ok: true,
      data: { files: ['main.js', 'package.json'] },
    });
  });

  describe('a remote fiddle', () => {
    const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
    const gist = {
      id: ID,
      owner: { login: 'octocat' },
      files: { 'main.js': { filename: 'main.js', content: 'console.log(1)' } },
      history: [{ version: '1'.repeat(40) }],
    };
    const isTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    beforeEach(async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
      vi.mocked((await import('electron')).net.fetch).mockImplementation(async () =>
        Response.json(gist),
      );
    });
    afterEach(() => {
      if (isTTY) Object.defineProperty(process.stdin, 'isTTY', isTTY);
      else delete (process.stdin as { isTTY?: boolean }).isTTY;
    });

    const remoteInput = (id: 'run' | 'bisect' | 'package' | 'make', trust: boolean) =>
      descriptors[id].input.parse({ fiddle: ID, good: '30.0.0', bad: '31.0.0', trust });

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
        try {
          expect((await run(id, remoteInput(id, true))).code).not.toBe(
            CliErrorCode.untrusted,
          );
        } finally {
          vi.unstubAllEnvs();
        }
      },
    );
  });

  it('needs GITHUB_TOKEN to write a gist, and never uses the app’s stored token', async () => {
    const result = await run('gist delete', { id: '8c5fc0c6a5153d49b5a4a56d3ed9da8f' });
    expect(result.code).toBe(ErrorCode.unauthorized);
    expect(
      (await run('gist publish', { dir: path.join(dir, 'missing'), public: false })).code,
    ).toBe(ErrorCode.unauthorized);
    const invalid = await run('gist history', { id: 'not a gist' });
    expect(invalid.code).toBe(ErrorCode.invalidArgument);
  });
});
