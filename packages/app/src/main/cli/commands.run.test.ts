/** run, bisect, package and make in the CLI: which Electron they pick, what they report while a fiddle runs, and the trust prompt. Electron itself is a fake child process. */
import { EventEmitter } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Installer } from '@electron/fiddle-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode, FiddleError } from '../../shared/errors';
import { descriptors } from './descriptors';
import { CliErrorCode, Reporter } from './output';

const paths = vi.hoisted(() => ({ cache: '' }));
const question = vi.hoisted(() => vi.fn<(query: string) => Promise<string>>());
vi.mock('../test-mode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../test-mode')>()),
  getCacheRoot: () => paths.cache,
}));
vi.mock('electron', () => ({
  app: { getSystemLocale: () => 'en-US' },
  net: { fetch: vi.fn() },
  shell: {},
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
vi.mock('../../fiddle/modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../fiddle/modules')>()),
  loadLoginShellPath: async () => undefined,
  findPackageManager: vi.fn(),
  installModules: vi.fn(),
}));
// Electron and Forge never start: a run gets a fake child, a build a fake task.
vi.mock('../run/process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../run/process')>()),
  spawnElectron: vi.fn(),
  stopChild: vi.fn(),
}));
vi.mock('../packaging/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../packaging/service')>()),
  runForgeTask: vi.fn(),
}));
vi.mock('../platform/sfw', () => ({
  sfwPathFor: async (enabled: boolean) => (enabled ? '/sfw/dist/sfw.mjs' : undefined),
}));
vi.mock('node:readline/promises', () => ({
  default: { createInterface: () => ({ question, close: () => undefined }) },
}));

const { net } = await import('electron');
const { findPackageManager, installModules } = await import('../../fiddle/modules');
const { runForgeTask } = await import('../packaging/service');
const { spawnElectron, stopChild } = await import('../run/process');
const { runCommand } = await import('./commands');

const RELEASES = [
  { version: '99.1.0', date: '2099-01-02', node: '30.0.0' },
  { version: '99.0.0', date: '2099-01-01', node: '30.0.0' },
  { version: '98.0.0', date: '2098-06-01', node: '29.0.0' },
  { version: '97.0.0', date: '2098-01-01', node: '28.0.0' },
  { version: '12.0.0', date: '2021-03-02', node: '14.16.0' },
];

let dir: string;
let folder: string;
/** The version of each installed executable. */
let installed: Map<string, string>;
const isTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'fiddle-cli-run-'));
  paths.cache = path.join(dir, 'cache');
  await mkdir(paths.cache);
  await writeFile(path.join(paths.cache, 'releases.json'), JSON.stringify(RELEASES));
  folder = path.join(dir, 'my-fiddle');
  await mkdir(folder);
  await writeFile(path.join(folder, 'main.js'), 'console.log(1)');
  installed = new Map();
  // Run dirs and build projects are made in the temp dir: keep them in the test's folder.
  for (const key of ['TMPDIR', 'TEMP', 'TMP']) vi.stubEnv(key, dir);
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  vi.mocked(findPackageManager).mockResolvedValue('/usr/bin/npm');
  vi.mocked(installModules).mockResolvedValue({ code: 0, signal: null, output: '' });
  vi.mocked(runForgeTask).mockResolvedValue(undefined);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (isTTY) Object.defineProperty(process.stdin, 'isTTY', isTTY);
  else delete (process.stdin as { isTTY?: boolean }).isTTY;
  await rm(dir, { recursive: true, force: true });
});

/** An installed release: its executable in the cache, empty. */
async function fakeInstall(version: string): Promise<string> {
  const exec = Installer.getExecPath(path.join(paths.cache, 'electron', version));
  await mkdir(path.dirname(exec), { recursive: true });
  await writeFile(exec, '');
  installed.set(exec, version);
  return exec;
}

type SpawnOptions = Parameters<typeof spawnElectron>[0];
interface FakeChild extends EventEmitter {
  stdout: EventEmitter & { setEncoding(encoding: string): void };
  stderr: EventEmitter & { setEncoding(encoding: string): void };
}

/** Each spawn gets a fresh child; `play` decides what it prints and how it ends, once the CLI is listening. */
function electronThat(
  play: (child: FakeChild, options: SpawnOptions) => void,
): SpawnOptions[] {
  const spawned: SpawnOptions[] = [];
  vi.mocked(spawnElectron).mockImplementation(async (options) => {
    spawned.push(options);
    const stream = () =>
      Object.assign(new EventEmitter(), { setEncoding: () => undefined });
    const child: FakeChild = Object.assign(new EventEmitter(), {
      stdout: stream(),
      stderr: stream(),
    });
    setImmediate(() => play(child, options));
    return child as never;
  });
  return spawned;
}

const exitsWith = (code: number) => (child: FakeChild) => child.emit('close', code, null);

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const SHA = '1'.repeat(40);
/** A gist as GitHub returns it: a remote fiddle, so it needs trust. `helpers.js` is a file fiddles don't usually have, kept without asking. */
function serveGist(
  files: Record<string, string> = {
    'main.js': 'console.log(1)',
    'helpers.js': '// help',
  },
): void {
  const gist = {
    id: ID,
    owner: { login: 'octocat' },
    files: Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, { filename: name, content }]),
    ),
    history: [{ version: SHA }],
  };
  vi.mocked(net.fetch).mockImplementation(async () => Response.json(gist));
}

type Id = 'run' | 'bisect' | 'package' | 'make';
interface Event {
  type: string;
  level?: string;
  text?: string;
  stream?: string;
  ok?: boolean;
  data?: Record<string, unknown>;
}

/** Runs with `--json` and the command's defaults: the exit code or error code, and the events on stdout. */
function run(
  id: Id,
  input: Record<string, unknown>,
  signal = new AbortController().signal,
) {
  const lines: string[] = [];
  const reporter = new Reporter(true, id, {
    stdout: (text) => lines.push(text),
    stderr: () => undefined,
  });
  const events = () => lines.map((line) => JSON.parse(line) as Event);
  const parsed = descriptors[id].input.parse(input) as Record<string, unknown>;
  return runCommand(id, parsed, { reporter, signal }).then(
    (exit) => ({ exit, code: undefined, events: events() }),
    (error: unknown) => {
      const { code, message, details } = FiddleError.from(error);
      return { exit: undefined, code, message, details, events: events() };
    },
  );
}

const logs = (events: Event[]) =>
  events
    .filter((e) => e.type === 'log')
    .map((e) => (e.level === 'info' ? '' : `${e.level}: `) + e.text);

describe('run', () => {
  it('runs a folder on an installed release, forwarding its output and exit code', async () => {
    const exec = await fakeInstall('99.0.0');
    const spawned = electronThat((child) => {
      child.stdout.emit('data', 'hello\nwor');
      child.stdout.emit('data', 'ld');
      child.stderr.emit('data', 'oops\n');
      child.emit('close', 3, null);
    });
    const result = await run('run', {
      fiddle: folder,
      version: 'v99.0.0',
      flag: ['--inspect'],
      env: ['FOO=bar', 'nonsense', 'LD_PRELOAD=/tmp/evil.so'],
    });

    expect(result.exit).toBe(3);
    expect(logs(result.events)).toEqual([
      'warn: envInvalid {"entries":"nonsense"}',
      'warn: envBlocked {"keys":"LD_PRELOAD"}',
      'started {"version":"99.0.0","name":"my-fiddle"}',
      'exitedCode {"code":3}',
    ]);
    expect(
      result.events
        .filter((e) => e.type === 'output')
        .map((e) => `${e.stream}: ${e.text}`),
    ).toEqual(['stdout: hello', 'stderr: oops', 'stdout: world']);
    expect(result.events.at(-1)).toMatchObject({
      ok: true,
      data: {
        name: 'my-fiddle',
        origin: 'local',
        version: '99.0.0',
        result: 'failure',
        exitCode: 3,
        signal: null,
      },
    });
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toMatchObject({
      exec,
      flags: ['--inspect'],
      env: { ELECTRON_ENABLE_LOGGING: 'true', FOO: 'bar' },
      inspect: false,
    });
    expect(spawned[0]!.env).not.toHaveProperty('LD_PRELOAD');
    // The run dir is gone once the run is over.
    expect(existsSync(spawned[0]!.runDir)).toBe(false);
    expect(net.fetch).not.toHaveBeenCalled();
  });

  it('uses the version the fiddle’s package.json asks for when no --version is given', async () => {
    await fakeInstall('98.0.0');
    await writeFile(
      path.join(folder, 'package.json'),
      JSON.stringify({ devDependencies: { electron: '^98.0.0' } }),
    );
    electronThat(exitsWith(0));
    const result = await run('run', { fiddle: folder });
    expect(result).toMatchObject({ exit: 0 });
    expect(result.events.at(-1)?.data).toMatchObject({
      version: '98.0.0',
      result: 'success',
    });
  });

  it('runs a local build given as a folder or as its executable, without a release', async () => {
    const build = path.join(dir, 'out', 'Testing');
    const exec = Installer.getExecPath(build);
    await mkdir(path.dirname(exec), { recursive: true });
    await writeFile(exec, '');
    const spawned = electronThat(exitsWith(0));

    for (const electronPath of [build, exec]) {
      const result = await run('run', { fiddle: folder, electronPath });
      expect(result.events.at(-1)?.data).toMatchObject({
        version: exec,
        result: 'success',
      });
    }
    expect(spawned.map((s) => s.exec)).toEqual([exec, exec]);
    expect((await run('run', { fiddle: folder, electronPath: dir })).code).toBe(
      ErrorCode.notFound,
    );
  });

  it('refuses an ES module main entry on Electron older than 28', async () => {
    await fakeInstall('12.0.0');
    await rm(path.join(folder, 'main.js'));
    await writeFile(path.join(folder, 'main.mjs'), 'export {}');
    const result = await run('run', { fiddle: folder, version: '12.0.0' });
    expect(result.code).toBe(ErrorCode.invalidArgument);
    expect(spawnElectron).not.toHaveBeenCalled();
  });

  it('needs the package manager when there are modules to install', async () => {
    await fakeInstall('99.0.0');
    vi.mocked(findPackageManager).mockResolvedValue(null);
    const result = await run('run', {
      fiddle: folder,
      version: '99.0.0',
      module: ['lodash'],
      pm: 'yarn',
    });
    expect(result.code).toBe(ErrorCode.unavailable);
    expect(findPackageManager).toHaveBeenCalledWith('yarn', expect.anything());
    expect(spawnElectron).not.toHaveBeenCalled();
  });

  it('installs a trusted gist’s modules with scripts off, and adds Electron to package.json only afterwards', async () => {
    await fakeInstall('99.0.0');
    serveGist();
    let atInstall: unknown;
    vi.mocked(installModules).mockImplementation(async ({ dir: appDir, onOutput }) => {
      atInstall = JSON.parse(readFileSync(path.join(appDir, 'package.json'), 'utf8'));
      onOutput?.('added 1 package\n');
      return { code: 0, signal: null, output: '' };
    });
    let atSpawn: unknown;
    electronThat((child, { appDir }) => {
      atSpawn = JSON.parse(readFileSync(path.join(appDir, 'package.json'), 'utf8'));
      child.emit('close', 0, null);
    });

    const result = await run('run', {
      fiddle: ID,
      version: '99.0.0',
      module: ['lodash'],
      trust: true,
    });

    expect(result).toMatchObject({ exit: 0 });
    expect(installModules).toHaveBeenCalledWith(
      expect.objectContaining({
        packageManager: 'npm',
        modules: { lodash: 'latest' },
        ignoreScripts: true,
        sfwPath: '/sfw/dist/sfw.mjs',
      }),
    );
    expect(atInstall).not.toHaveProperty('devDependencies');
    expect(atSpawn).toMatchObject({
      dependencies: { lodash: 'latest' },
      devDependencies: { electron: '99.0.0' },
    });
    expect(logs(result.events).slice(0, 1)).toEqual([
      'installingModulesNoScripts {"pm":"npm"}',
    ]);
    expect(result.events.find((e) => e.type === 'output')).toMatchObject({
      stream: 'stderr',
      text: 'added 1 package',
    });
    expect(result.events.at(-1)?.data).toMatchObject({
      origin: `gist:octocat/${ID}@${SHA}`,
    });
  });

  it('lets a local fiddle’s modules run their install scripts', async () => {
    await fakeInstall('99.0.0');
    electronThat(exitsWith(0));
    await run('run', { fiddle: folder, version: '99.0.0', module: ['lodash@4.17.21'] });
    expect(installModules).toHaveBeenCalledWith(
      expect.objectContaining({ modules: { lodash: '4.17.21' }, ignoreScripts: false }),
    );
  });

  it('stops the fiddle when the command is aborted, and reports the signal it died of', async () => {
    await fakeInstall('99.0.0');
    const controller = new AbortController();
    electronThat((child) => {
      controller.abort();
      child.emit('close', null, 'SIGTERM');
    });
    const result = await run(
      'run',
      { fiddle: folder, version: '99.0.0' },
      controller.signal,
    );
    expect(stopChild).toHaveBeenCalledTimes(1);
    expect(logs(result.events).at(-1)).toBe('exitedSignal {"signal":"SIGTERM"}');
    expect(result.events.at(-1)?.data).toMatchObject({
      result: 'failure',
      signal: 'SIGTERM',
    });
    expect(result.exit).toBe(128 + 15);
  });

  it('reports an Electron that could not start, and exits 1', async () => {
    await fakeInstall('99.0.0');
    electronThat((child) => {
      child.emit('error', new Error('EACCES'));
      child.emit('close', null, null);
    });
    const result = await run('run', { fiddle: folder, version: '99.0.0' });
    expect(result.exit).toBe(1);
    expect(logs(result.events)).toEqual([
      'started {"version":"99.0.0","name":"my-fiddle"}',
      'error: spawnFailed {"message":"EACCES"}',
    ]);
    expect(result.events.at(-1)?.data).toMatchObject({
      result: 'failure',
      exitCode: null,
      signal: null,
    });
  });
});

describe('the trust prompt', () => {
  let stderr = '';
  beforeEach(async () => {
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string) => {
      stderr += chunk;
      return true;
    }) as never);
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    await fakeInstall('99.0.0');
    serveGist();
    electronThat(exitsWith(0));
  });
  afterEach(() => void vi.mocked(process.stderr.write).mockRestore());

  it('describes the gist on the terminal and runs it on a yes', async () => {
    question.mockResolvedValue(' Yes ');
    const result = await run('run', {
      fiddle: ID,
      version: '99.0.0',
      module: ['lodash'],
    });
    expect(result).toMatchObject({ exit: 0 });
    expect(question).toHaveBeenCalledWith('trustQuestion ', expect.anything());
    expect(stderr).toContain(`detailOrigin {"origin":"gist:octocat/${ID}@${SHA}"}`);
    expect(stderr).toContain('detailFiles {"files":"main.js, helpers.js"}');
    expect(stderr).toContain('detailDependencies {"dependencies":"lodash@latest"}');
  });

  it('refuses on any other answer, before anything runs', async () => {
    question.mockResolvedValue('sure');
    expect((await run('run', { fiddle: ID })).code).toBe(CliErrorCode.untrusted);
    expect(spawnElectron).not.toHaveBeenCalled();
  });

  it('is cancelled by Ctrl+C, and passes on other failures', async () => {
    question.mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );
    expect((await run('package', { fiddle: ID })).code).toBe(ErrorCode.cancelled);
    question.mockRejectedValue(new Error('stdin closed'));
    expect(await run('package', { fiddle: ID })).toMatchObject({
      code: ErrorCode.internal,
      message: 'stdin closed',
    });
    expect(runForgeTask).not.toHaveBeenCalled();
  });
});

describe('bisect', () => {
  beforeEach(async () => {
    for (const version of ['97.0.0', '98.0.0', '99.0.0', '99.1.0'])
      await fakeInstall(version);
  });

  /** A fiddle that passes before `firstBad` and fails from it on. */
  const brokenSince = (firstBad: string) =>
    electronThat((child, { exec }) =>
      child.emit('close', installed.get(exec)! < firstBad ? 0 : 1, null),
    );

  it('finds the first bad release between a good and a bad one', async () => {
    const spawned = brokenSince('99.0.0');
    const result = await run('bisect', {
      fiddle: folder,
      good: 'v97.0.0',
      bad: '99.1.0',
    });

    const url = 'https://github.com/electron/electron/compare/v98.0.0...v99.0.0';
    expect(result.events.at(-1)).toMatchObject({
      ok: true,
      data: {
        good: '98.0.0',
        bad: '99.0.0',
        url,
        steps: [
          { version: '97.0.0', good: true },
          { version: '99.1.0', good: false },
          { version: '98.0.0', good: true },
          { version: '99.0.0', good: false },
        ],
      },
    });
    expect(spawned.map((s) => installed.get(s.exec))).toEqual([
      '97.0.0',
      '99.1.0',
      '98.0.0',
      '99.0.0',
    ]);
    expect(logs(result.events).filter((line) => line.startsWith('bisect'))).toEqual([
      'bisectStep {"version":"97.0.0"}',
      'bisectVerdictGood {"version":"97.0.0"}',
      'bisectStep {"version":"99.1.0"}',
      'bisectVerdictBad {"version":"99.1.0"}',
      'bisectStep {"version":"98.0.0"}',
      'bisectVerdictGood {"version":"98.0.0"}',
      'bisectStep {"version":"99.0.0"}',
      'bisectVerdictBad {"version":"99.0.0"}',
    ]);
  });

  it('fails when an end doesn’t behave as promised, with the steps so far', async () => {
    brokenSince('97.0.0');
    const result = await run('bisect', { fiddle: folder, good: '97.0.0', bad: '99.1.0' });
    expect(result).toMatchObject({
      code: CliErrorCode.bisectFailed,
      details: { steps: [{ version: '97.0.0', good: false }] },
    });
  });

  it('stops when a step can’t run, saying why', async () => {
    // 97.0.0 isn't installed and can't be downloaded.
    await rm(path.join(paths.cache, 'electron', '97.0.0'), { recursive: true });
    vi.mocked(net.fetch).mockRejectedValue(new Error('offline'));
    brokenSince('99.0.0');
    const result = await run('bisect', { fiddle: folder, good: '97.0.0', bad: '99.1.0' });
    expect(result.code).toBe(CliErrorCode.bisectFailed);
    expect(logs(result.events)).toEqual([
      'bisectStep {"version":"97.0.0"}',
      'downloading {"version":"97.0.0"}',
      expect.stringMatching(/^error: downloadFailed /),
    ]);
    expect(spawnElectron).not.toHaveBeenCalled();
  });

  it.each([
    ['99.1.0', '97.0.0', ErrorCode.invalidArgument],
    ['97.0.0', '97.0.0', ErrorCode.invalidArgument],
    ['96.0.0', '99.1.0', ErrorCode.notFound],
  ])('refuses good %s and bad %s with %s', async (good, bad, code) => {
    vi.mocked(net.fetch).mockRejectedValue(new Error('offline'));
    expect((await run('bisect', { fiddle: folder, good, bad })).code).toBe(code);
    expect(spawnElectron).not.toHaveBeenCalled();
  });
});

describe('package and make', () => {
  it('writes the fiddle as a Forge project to a temp folder, runs the task there and says where the output is', async () => {
    const result = await run('package', {
      fiddle: folder,
      version: '99.0.0',
      pm: 'yarn',
    });

    expect(result.code).toBeUndefined();
    const { dir: project, out } = result.events.at(-1)!.data as {
      dir: string;
      out: string;
    };
    expect(path.basename(project)).toMatch(/^electron-fiddle-package-/);
    expect(out).toBe(path.join(project, 'out'));
    expect(runForgeTask).toHaveBeenCalledWith(
      project,
      'yarn',
      'package',
      expect.objectContaining({ ignoreScripts: false, sfwPath: '/sfw/dist/sfw.mjs' }),
    );
    const packageJson = JSON.parse(
      readFileSync(path.join(project, 'package.json'), 'utf8'),
    );
    expect(packageJson).toMatchObject({
      name: 'my-fiddle',
      devDependencies: { electron: '99.0.0' },
    });
    expect(readFileSync(path.join(project, 'main.js'), 'utf8')).toBe('console.log(1)');
    expect(logs(result.events)).toEqual([
      `packaging ${JSON.stringify({ path: project })}`,
    ]);
    // Nothing was downloaded: Forge installs Electron itself.
    expect(net.fetch).not.toHaveBeenCalled();
  });

  it('keeps a remote fiddle’s install scripts off, and removes the project of a failed task', async () => {
    serveGist();
    vi.mocked(runForgeTask).mockImplementation(
      async (project, _pm, _task, { onOutput }) => {
        onOutput('electron-forge: command failed\n');
        expect(existsSync(project)).toBe(true);
        return { command: 'npm run make', code: 1 };
      },
    );
    const result = await run('make', { fiddle: ID, version: '99.0.0', trust: true });

    expect(result).toMatchObject({
      code: CliErrorCode.taskFailed,
      details: { command: 'npm run make', code: 1 },
    });
    const [project, , task, options] = vi.mocked(runForgeTask).mock.calls[0]!;
    expect(task).toBe('make');
    expect(options).toMatchObject({ ignoreScripts: true });
    expect(existsSync(project)).toBe(false);
    expect(logs(result.events)).toEqual([`making ${JSON.stringify({ path: project })}`]);
    expect(result.events.find((e) => e.type === 'output')?.text).toBe(
      'electron-forge: command failed',
    );
  });

  it('packages with a local build instead of a release', async () => {
    const build = path.join(dir, 'out', 'Testing');
    const exec = Installer.getExecPath(build);
    await mkdir(path.dirname(exec), { recursive: true });
    await writeFile(exec, '');
    const result = await run('package', { fiddle: folder, electronPath: exec });
    expect(result.code).toBeUndefined();
    const project = vi.mocked(runForgeTask).mock.calls[0]![0];
    // The local-Electron plugin points at the build's folder, also when its executable was given.
    const packageJson = JSON.parse(
      readFileSync(path.join(project, 'package.json'), 'utf8'),
    );
    expect(packageJson.config.forge.plugins).toEqual([
      expect.objectContaining({ config: { electronPath: build } }),
    ]);
    // A local build has no release to install: the project gets the latest stable instead.
    expect(packageJson.devDependencies).toMatchObject({ electron: '99.1.0' });
  });

  it.each([
    [{ version: '1.0.0' }, ErrorCode.notFound],
    [{ electronPath: 'missing-build' }, ErrorCode.notFound],
    [{ pm: 'yarn' }, ErrorCode.unavailable],
  ])('refuses %j with %s before writing anything', async (input, code) => {
    vi.mocked(net.fetch).mockRejectedValue(new Error('offline'));
    if ('pm' in input) vi.mocked(findPackageManager).mockResolvedValue(null);
    expect((await run('package', { fiddle: folder, ...input })).code).toBe(code);
    expect(runForgeTask).not.toHaveBeenCalled();
  });
});
