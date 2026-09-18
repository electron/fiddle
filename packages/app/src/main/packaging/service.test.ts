import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IGNORE_SCRIPTS_ENV } from '../../fiddle/modules';

vi.mock('electron', () => ({ shell: { openPath: vi.fn() } }));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../documents/service', () => ({
  installScriptPackages: vi.fn(),
  ensureTrusted: vi.fn(),
}));
vi.mock('../run/service', () => ({ PM_INSTALL_URLS: { npm: '', yarn: '' } }));
vi.mock('../../fiddle/modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../fiddle/modules')>()),
  findPackageManager: async () => '/bin/npm',
}));

const documents = await import('../documents/service');
const { forgeTaskCommands, packageFiddle, runForgeTask } = await import('./service');

describe('forgeTaskCommands', () => {
  it('installs through Socket Firewall when given sfw.mjs, like a run', () => {
    expect(
      forgeTaskCommands('npm', 'make', { sfwPath: '/res/sfw.mjs', ignoreScripts: true }),
    ).toEqual([
      {
        command: 'node',
        args: ['/res/sfw.mjs', 'npm', 'install', '-S'],
        env: IGNORE_SCRIPTS_ENV,
      },
      { command: 'npm', args: ['run', 'make'] },
    ]);
  });

  it('runs the package manager directly without it', () => {
    expect(forgeTaskCommands('yarn', 'package')).toEqual([
      { command: 'yarn', args: ['install'] },
      { command: 'yarn', args: ['run', 'package'] },
    ]);
    expect(forgeTaskCommands('npm', 'package', { sfwPath: undefined })[0]).toEqual({
      command: 'npm',
      args: ['install', '-S'],
    });
  });
});

describe('runForgeTask', () => {
  let dir: string;
  let fakeSfw: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'fiddle-forge-task-'));
    // Stands in for sfw.mjs: records what it was asked to run, then fails, so `<pm> run` never starts.
    fakeSfw = path.join(dir, 'fake-sfw.mjs');
    await writeFile(
      fakeSfw,
      `import { writeFileSync } from 'node:fs';
writeFileSync('args.json', JSON.stringify({ args: process.argv.slice(2), ignoreScripts: process.env.npm_config_ignore_scripts ?? null }));
console.log('blocked by sfw');
process.exit(1);`,
    );
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('wraps the install with sfw.mjs and reports the wrapped command when it fails', async () => {
    const output: string[] = [];
    const failed = await runForgeTask(dir, 'npm', 'package', {
      env: process.env,
      onOutput: (text) => output.push(text),
      ignoreScripts: true,
      sfwPath: fakeSfw,
    });
    expect(failed).toEqual({ command: `node ${fakeSfw} npm install -S`, code: 1 });
    expect(JSON.parse(await readFile(path.join(dir, 'args.json'), 'utf8'))).toEqual({
      args: ['npm', 'install', '-S'],
      ignoreScripts: 'true',
    });
    expect(output.join('')).toContain('blocked by sfw');
  });
});

describe('packageFiddle', () => {
  let tmp: string;
  let previousTmp: Record<string, string | undefined>;
  beforeEach(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'fiddle-package-'));
    previousTmp = {
      TMPDIR: process.env.TMPDIR,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
    };
    process.env.TMPDIR = process.env.TEMP = process.env.TMP = tmp;
    vi.mocked(documents.installScriptPackages).mockResolvedValue([]);
  });
  afterEach(async () => {
    for (const [name, value] of Object.entries(previousTmp)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await rm(tmp, { recursive: true, force: true });
  });

  function setup(sfwPath?: string) {
    const run = { status: 'ready' as string, task: 'run' as string };
    const events: string[] = [];
    const runs = {
      isBusy: () => run.status !== 'ready',
      openConsole: () => undefined,
      claim: () => new AbortController(),
      release: () => events.push('release'),
      setState: (_id: string, patch: Partial<typeof run>) => Object.assign(run, patch),
      log: (_id: string, text: string) => events.push(text),
      logText: () => undefined,
      toolEnv: async () => process.env,
      sfwPath: () => sfwPath,
    };
    const hub = {
      getWindow: () => ({ fiddle: { name: 'My fiddle' } }),
      app: { settings: { packageManager: 'npm', packageAuthor: 'me' } },
    };
    const versions = {
      releases: () => [],
      localBuild: () => undefined,
      electronVersions: {},
    };
    const call = () => packageFiddle('w', 'package', { hub, runs, versions } as never);
    return { run, events, call };
  }

  const fiddle = {
    files: { 'main.js': 'app()' },
    modules: {},
    version: { kind: 'release', version: '30.0.0' },
  };

  it('is busy from the start, while it waits for the approval', async () => {
    const { run, events, call } = setup();
    let answer!: (result: { approved: false; allowScripts: false }) => void;
    vi.mocked(documents.ensureTrusted).mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );

    const first = call();
    expect(run).toMatchObject({ status: 'checking', task: 'package' });
    await call();
    expect(documents.ensureTrusted).toHaveBeenCalledTimes(1);

    answer({ approved: false, allowScripts: false });
    await first;
    expect(events).toEqual(['untrusted', 'release']);
    expect(run).toMatchObject({ status: 'ready', task: 'run' });
  });

  it('removes the temp project when the build fails', async () => {
    const sfw = path.join(tmp, 'fail-sfw.mjs');
    await writeFile(sfw, 'process.exit(1);');
    const { run, events, call } = setup(sfw);
    vi.mocked(documents.ensureTrusted).mockResolvedValue({
      approved: true,
      allowScripts: false,
      fiddle,
    } as never);

    await call();

    expect(events).toEqual(['packaging', 'commandFailed', 'release']);
    expect(
      (await readdir(tmp)).filter((name) => name.startsWith('electron-fiddle-')),
    ).toEqual([]);
    expect(run.status).toBe('ready');
  });
});
