import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '../shared/errors';
import {
  buildInstallCommand,
  buildRunScriptCommand,
  checkModuleSpec,
  findInstallScripts,
  findPackageManager,
  IGNORE_SCRIPTS_ENV,
  installModules,
  isFloatingVersion,
  isValidPackageName,
  isValidVersionSpec,
  loadLoginShellPath,
  pickLatestVersion,
  runCommand,
} from './modules';

describe('module specs', () => {
  it.each(['lodash', '@types/node', 'JSONStream', 'a-b.c_d~e', '@scope/pkg.name', 'x'])(
    'accepts the name %s',
    (name) => expect(isValidPackageName(name)).toBe(true),
  );

  it.each([
    '',
    '.hidden',
    '_under',
    '@scope',
    '@/x',
    'a/b',
    '@a/b/c',
    'node_modules',
    'a b',
    'x'.repeat(215),
    'é',
    '-g',
    '--prefix=/x',
    '@-x/y',
    '@scope/-x',
  ])('rejects the name %j', (name) => expect(isValidPackageName(name)).toBe(false));

  it.each([
    '1.2.3',
    '^1.2.3',
    '~1.0',
    '>=1 <2',
    '1.x || 2.x',
    '*',
    '1.0.0-beta.1',
    'latest',
    'next',
    'beta',
  ])('accepts the spec %s', (spec) => expect(isValidVersionSpec(spec)).toBe(true));

  it.each([
    'git+https://github.com/a/b.git',
    'git://github.com/a/b',
    'github:user/repo',
    'user/repo',
    'https://example.com/x.tgz',
    'file:../x',
    '../x',
    'link:x',
    'npm:lodash@1',
    'workspace:*',
    '1.0.0#abc',
    '',
    ' 1.0.0',
    '1.0.0"',
    '%PATH%',
  ])('rejects the spec %j', (spec) => expect(isValidVersionSpec(spec)).toBe(false));

  it('says which part is wrong', () => {
    expect(checkModuleSpec('ok', '1.0.0')).toBeNull();
    expect(checkModuleSpec('Bad Name', '1.0.0')).toBe('invalid-name');
    expect(checkModuleSpec('ok', 'file:x')).toBe('invalid-spec');
  });
});

describe('install commands', () => {
  const modules = { lodash: '4.17.21', '@types/node': '^20' };

  it('uses npm install -S, with -- before the specs', () => {
    expect(buildInstallCommand({ packageManager: 'npm', modules })).toEqual({
      command: 'npm',
      args: ['install', '-S', '--', 'lodash@4.17.21', '@types/node@^20'],
    });
    expect(buildInstallCommand({ packageManager: 'npm' })).toEqual({
      command: 'npm',
      args: ['install', '-S'],
    });
  });

  it('uses yarn add, or yarn install with no modules', () => {
    expect(buildInstallCommand({ packageManager: 'yarn', modules })).toEqual({
      command: 'yarn',
      args: ['add', '--', 'lodash@4.17.21', '@types/node@^20'],
    });
    expect(buildInstallCommand({ packageManager: 'yarn' })).toEqual({
      command: 'yarn',
      args: ['install'],
    });
  });

  it('turns scripts off through the environment, not a flag Yarn 2+ rejects', () => {
    expect(
      buildInstallCommand({
        packageManager: 'npm',
        modules: { a: '1.0.0' },
        ignoreScripts: true,
      }),
    ).toEqual({
      command: 'npm',
      args: ['install', '-S', '--', 'a@1.0.0'],
      env: IGNORE_SCRIPTS_ENV,
    });
    expect(buildInstallCommand({ packageManager: 'yarn', ignoreScripts: true })).toEqual({
      command: 'yarn',
      args: ['install'],
      env: { npm_config_ignore_scripts: 'true', YARN_ENABLE_SCRIPTS: 'false' },
    });
    expect(
      buildInstallCommand({ packageManager: 'npm', modules: { a: '1.0.0' } }).env,
    ).toBeUndefined();
  });

  it('wraps with sfw', () => {
    expect(
      buildInstallCommand({
        packageManager: 'yarn',
        modules: { a: '1.0.0' },
        sfwPath: '/app/sfw/dist/sfw.mjs',
      }),
    ).toEqual({
      command: 'node',
      args: ['/app/sfw/dist/sfw.mjs', 'yarn', 'add', '--', 'a@1.0.0'],
    });
  });

  it('refuses package names that would read as flags', () => {
    for (const name of ['--global', '-g', '--prefix=/tmp/x']) {
      expect(() =>
        buildInstallCommand({ packageManager: 'npm', modules: { [name]: '1.0.0' } }),
      ).toThrow(
        expect.objectContaining({
          code: ErrorCode.invalidArgument,
          details: expect.objectContaining({ reason: 'invalid-name' }),
        }),
      );
    }
  });

  it('refuses bad specs', () => {
    expect(() =>
      buildInstallCommand({ packageManager: 'npm', modules: { a: 'git+ssh://x' } }),
    ).toThrow(
      expect.objectContaining({
        code: ErrorCode.invalidArgument,
        details: { reason: 'invalid-spec', name: 'a', spec: 'git+ssh://x' },
      }),
    );
  });

  it('builds run-script commands', () => {
    expect(buildRunScriptCommand('npm', 'make')).toEqual({
      command: 'npm',
      args: ['run', 'make'],
    });
    expect(buildRunScriptCommand('yarn', 'package')).toEqual({
      command: 'yarn',
      args: ['run', 'package'],
    });
  });
});

describe('versions', () => {
  it('floats only `*`, `latest` and empty specs', () => {
    for (const spec of ['*', 'latest', '', 'x'])
      expect(isFloatingVersion(spec), spec).toBe(true);
    for (const spec of ['1.2.3', '^4.18.2', '~1.0.0', '>=1 <3', '4.x', 'next', 'beta'])
      expect(isFloatingVersion(spec), spec).toBe(false);
    expect(pickLatestVersion(['1.0.0', '10.0.0', '2.0.0', '11.0.0-beta.1'])).toBe(
      '10.0.0',
    );
    expect(pickLatestVersion([])).toBeUndefined();
  });
});

vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof import('node:child_process')>();
  return { ...actual, execFile: vi.fn(actual.execFile) };
});

/** Makes the next `execFile` call print `result`, or fail with it. */
function fakeExec(result: string | Error): void {
  vi.mocked(execFile).mockImplementationOnce(((...args: unknown[]) => {
    const callback = args.at(-1) as (error: Error | null, stdout: string) => void;
    if (result instanceof Error) callback(result, '');
    else callback(null, result);
  }) as never);
}

const lastExec = () => vi.mocked(execFile).mock.lastCall as unknown[] | undefined;

/** Runs `fn` with `process.platform` set to `platform`. */
async function withPlatform<T>(
  platform: NodeJS.Platform,
  fn: () => T,
): Promise<Awaited<T>> {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...original, value: platform });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'platform', original);
  }
}

describe('host lookups', () => {
  it('finds the package manager with which or where.exe', async () => {
    fakeExec('/usr/local/bin/npm\n');
    expect(await withPlatform('darwin', () => findPackageManager('npm'))).toBe(
      '/usr/local/bin/npm',
    );
    expect(lastExec()?.slice(0, 2)).toEqual(['which', ['npm']]);

    fakeExec(
      'C:\\Program Files\\nodejs\\yarn\r\nC:\\Program Files\\nodejs\\yarn.cmd\r\n',
    );
    expect(await withPlatform('win32', () => findPackageManager('yarn'))).toBe(
      'C:\\Program Files\\nodejs\\yarn',
    );
    expect(lastExec()?.slice(0, 2)).toEqual(['where.exe', ['yarn']]);

    fakeExec(new Error('not found'));
    expect(await findPackageManager('npm')).toBeNull();
    fakeExec('');
    expect(await findPackageManager('npm')).toBeNull();
  });

  it('loads PATH from the login shell', async () => {
    fakeExec(
      'Welcome!\n\u001b[1m__FIDDLE_SHELL_PATH__\n/opt/homebrew/bin:/usr/bin\n__FIDDLE_SHELL_PATH__bye',
    );
    const result = await withPlatform('darwin', () =>
      loadLoginShellPath({ SHELL: '/bin/fish', HOME: '/h' }),
    );
    expect(result).toBe('/opt/homebrew/bin:/usr/bin');
    expect(lastExec()?.slice(0, 3)).toMatchObject([
      '/bin/fish',
      ['-ilc', expect.any(String)],
      { env: { SHELL: '/bin/fish', HOME: '/h', DISABLE_AUTO_UPDATE: 'true' } },
    ]);
  });

  it('defaults the shell and gives up quietly', async () => {
    fakeExec('nothing useful');
    expect(await withPlatform('linux', () => loadLoginShellPath({}))).toBeUndefined();
    expect(lastExec()?.[0]).toBe('/bin/sh');
    fakeExec(new Error('timeout'));
    expect(await withPlatform('darwin', () => loadLoginShellPath({}))).toBeUndefined();
    expect(lastExec()?.[0]).toBe('/bin/zsh');
    vi.mocked(execFile).mockClear();
    expect(await withPlatform('win32', () => loadLoginShellPath())).toBeUndefined();
    expect(execFile).not.toHaveBeenCalled();
  });

  it.skipIf(process.platform === 'win32')(
    'runs the login shell and reads PATH between the markers',
    async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'fiddle-shell-'));
      try {
        // A fake shell: ignores its arguments and prints a banner around the marked PATH.
        const shell = path.join(dir, 'fake-shell');
        await writeFile(
          shell,
          '#!/bin/sh\necho "Welcome"\necho __FIDDLE_SHELL_PATH__\necho /fake/bin:/usr/bin\necho __FIDDLE_SHELL_PATH__\necho bye\n',
          { mode: 0o755 },
        );
        expect(await loadLoginShellPath({ SHELL: shell })).toBe('/fake/bin:/usr/bin');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
});

describe('runCommand', () => {
  const node = process.execPath;

  it('collects output and the exit code', async () => {
    const chunks: string[] = [];
    const result = await runCommand(
      {
        command: node,
        args: ['-e', "console.log('out'); console.error('err'); process.exit(3)"],
      },
      { onOutput: (t) => chunks.push(t) },
    );
    expect(result.code).toBe(3);
    expect(result.output).toContain('out');
    expect(result.output).toContain('err');
    expect(chunks.join('')).toBe(result.output);
  });

  it('keeps a multi-byte character whole when it arrives in two chunks', async () => {
    const script =
      'process.stdout.write(Buffer.from([0xe2, 0x82])); setTimeout(() => process.stdout.write(Buffer.from([0xac, 0x0a])), 50)';
    const chunks: string[] = [];
    const result = await runCommand(
      { command: node, args: ['-e', script] },
      { onOutput: (t) => chunks.push(t) },
    );
    expect(result.output).toBe('\u20ac\n');
    expect(chunks.join('')).toBe('\u20ac\n');
  });

  it('passes on whole lines, and the unfinished last line at the end', async () => {
    const script =
      "process.stdout.write('ab'); setTimeout(() => { process.stdout.write('c\\nd'); setTimeout(() => process.stdout.write('e\\nf'), 50) }, 50)";
    const chunks: string[] = [];
    await runCommand(
      { command: node, args: ['-e', script] },
      { onOutput: (t) => chunks.push(t) },
    );
    expect(chunks).toEqual(['abc\n', 'de\n', 'f']);
  });

  it.skipIf(process.platform === 'win32')(
    'cancels with an AbortSignal, after the command and its children have exited',
    async () => {
      const script =
        'const { spawn } = require("node:child_process");' +
        'const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], { stdio: "inherit" });' +
        'console.log(process.pid, child.pid); setTimeout(() => {}, 20000)';
      const controller = new AbortController();
      let printed = '';
      const promise = runCommand(
        { command: node, args: ['-e', script] },
        {
          signal: controller.signal,
          onOutput: (text) => {
            printed += text;
            if (printed.includes('\n')) controller.abort();
          },
        },
      );
      await expect(promise).rejects.toMatchObject({ code: ErrorCode.cancelled });
      for (const pid of printed.trim().split(' ').map(Number))
        await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow());
    },
  );

  it('cancels with an AbortSignal', async () => {
    const controller = new AbortController();
    const promise = runCommand(
      { command: node, args: ['-e', 'setTimeout(() => {}, 20000)'] },
      { signal: controller.signal },
    );
    setTimeout(() => controller.abort(), 50);
    await expect(promise).rejects.toMatchObject({ code: ErrorCode.cancelled });
    const aborted = AbortSignal.abort();
    await expect(
      runCommand({ command: node, args: [] }, { signal: aborted }),
    ).rejects.toMatchObject({ code: ErrorCode.cancelled });
  });

  it('reports a missing command', async () => {
    const result = runCommand({ command: 'definitely-not-a-command-xyz', args: [] });
    // On Windows the shell starts fine, and reports the missing command itself.
    await (process.platform === 'win32'
      ? expect(result).resolves.toMatchObject({ code: 1 })
      : expect(result).rejects.toMatchObject({ code: ErrorCode.unavailable }));
  });

  it('refuses shell-special arguments on Windows', async () => {
    for (const arg of ['a"b', '%PATH%']) {
      await expect(
        runCommand({ command: 'npm', args: [arg] }, { platform: 'win32' }),
      ).rejects.toMatchObject({ code: ErrorCode.invalidArgument });
    }
  });
});

describe('installModules', () => {
  let root: string;
  let fakeSfw: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'fiddle-install-'));
    // Stands in for sfw.mjs: records its arguments, then exits with FAKE_EXIT.
    fakeSfw = path.join(root, 'fake-sfw.mjs');
    await writeFile(
      fakeSfw,
      `import { writeFileSync } from 'node:fs';
writeFileSync('args.json', JSON.stringify({
  args: process.argv.slice(2),
  ignoreScripts: process.env.npm_config_ignore_scripts ?? null,
  yarnScripts: process.env.YARN_ENABLE_SCRIPTS ?? null,
  token: process.env.GITHUB_TOKEN ?? null,
  npmToken: process.env.NPM_TOKEN ?? null,
}));
console.log('installed');
process.exit(Number(process.env.FAKE_EXIT ?? 0));`,
    );
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('runs inside the temp dir', async () => {
    const dir = await mkdtemp(path.join(root, 'run-'));
    const result = await installModules({
      dir,
      tempRoot: root,
      packageManager: 'npm',
      modules: { lodash: '4.17.21' },
      ignoreScripts: true,
      sfwPath: fakeSfw,
      env: process.env,
    });
    expect(result.output).toContain('installed');
    expect(JSON.parse(await readFile(path.join(dir, 'args.json'), 'utf8'))).toMatchObject(
      {
        args: ['npm', 'install', '-S', '--', 'lodash@4.17.21'],
        ignoreScripts: 'true',
        yarnScripts: 'false',
      },
    );
  });

  it('defaults to the package manager environment: the npm token in, other secrets out', async () => {
    const dir = await mkdtemp(path.join(root, 'run-'));
    const saved = {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      NPM_TOKEN: process.env.NPM_TOKEN,
    };
    process.env.GITHUB_TOKEN = 'ghp_secret';
    process.env.NPM_TOKEN = 'npm_secret';
    try {
      await installModules({
        dir,
        tempRoot: root,
        packageManager: 'npm',
        sfwPath: fakeSfw,
      });
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
    expect(JSON.parse(await readFile(path.join(dir, 'args.json'), 'utf8'))).toMatchObject(
      { token: null, npmToken: 'npm_secret' },
    );
  });

  it('throws install-failed on a non-zero exit', async () => {
    await expect(
      installModules({
        dir: root,
        tempRoot: root,
        packageManager: 'yarn',
        sfwPath: fakeSfw,
        env: { ...process.env, FAKE_EXIT: '1' },
      }),
    ).rejects.toMatchObject({ code: 'install-failed', details: { code: 1 } });
  });

  it('refuses directories outside the temp dir', async () => {
    const outside = await mkdtemp(path.join(tmpdir(), 'fiddle-outside-'));
    try {
      await expect(
        installModules({
          dir: outside,
          tempRoot: root,
          packageManager: 'npm',
          sfwPath: fakeSfw,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.invalidArgument });
      await expect(
        installModules({
          dir: path.join(root, '..'),
          tempRoot: root,
          packageManager: 'npm',
          sfwPath: fakeSfw,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.invalidArgument });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

describe('install scripts', () => {
  const packuments: Record<string, unknown> = {
    esbuild: {
      'dist-tags': { latest: '0.20.0' },
      versions: {
        '0.19.0': { hasInstallScript: true },
        '0.20.0': { hasInstallScript: true },
      },
    },
    lodash: { 'dist-tags': { latest: '4.17.21' }, versions: { '4.17.21': {} } },
    sharp: {
      'dist-tags': { latest: '0.33.0' },
      versions: { '0.32.0': { hasInstallScript: true }, '0.33.0': {} },
    },
  };
  const registryFetch = async (name: string) => packuments[name];

  it('lists modules whose resolved version has an install script', async () => {
    expect(
      await findInstallScripts(
        { esbuild: 'latest', lodash: '^4.0.0', sharp: '^0.32.0' },
        registryFetch,
      ),
    ).toEqual([
      { name: 'esbuild', version: '0.20.0' },
      { name: 'sharp', version: '0.32.0' },
    ]);
    expect(
      await findInstallScripts(
        { sharp: 'latest', lodash: '99.0.0', esbuild: 'constructor' },
        registryFetch,
      ),
    ).toEqual([]);
    expect(await findInstallScripts({}, registryFetch)).toEqual([]);
  });

  it('rejects unexpected metadata', async () => {
    await expect(
      findInstallScripts({ x: '1.0.0' }, async () => ({ nope: true })),
    ).rejects.toMatchObject({
      code: ErrorCode.internal,
    });
  });
});
