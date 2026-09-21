import child_process, { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { Writable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ElectronVersions,
  Fiddle,
  type Installer,
  Runner,
  type RunnerSpawnOptions,
} from '../src/index.js';

vi.mock('child_process');

const exec = '/path/to/electron/executable';
const fiddle = new Fiddle('/path/to/fiddle/main.js', 'test');
const quiet: RunnerSpawnOptions = { out: undefined, showConfig: false };

async function createRunner() {
  const install = vi.fn().mockResolvedValue(exec);
  const runner = await Runner.create({
    installer: { install } as Pick<Installer, 'install'> as Installer,
    versions: new ElectronVersions(['12.0.0', '12.0.1', '12.0.2']),
  });
  return { runner, install };
}

function fakeChild() {
  const child = Object.assign(new EventEmitter(), {
    stdout: { pipe: vi.fn() },
    stderr: { pipe: vi.fn() },
  });
  vi.mocked(child_process.spawn).mockReturnValue(child as unknown as ChildProcess);
  return child;
}

function spawnCall() {
  const [file, args, options] = vi.mocked(child_process.spawn).mock
    .calls[0] as unknown as [string, string[], RunnerSpawnOptions];
  return { file, args, options };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Runner.spawn()', () => {
  it('installs the version, spawns it and prints debug information to `out`', async () => {
    const { runner, install } = await createRunner();
    const child = fakeChild();
    const write = vi.fn();
    const out = { write } as Pick<Writable, 'write'> as Writable;

    await runner.spawn('12.0.1', fiddle, { out });

    expect(install).toHaveBeenCalledWith('12.0.1');
    expect(child_process.spawn).toHaveBeenCalledTimes(1);
    expect(child_process.spawn).toHaveBeenCalledWith(exec, [fiddle.mainPath], {
      args: [],
      out,
      showConfig: true,
    });
    // `out` is shared by both streams and by later runs, so it isn't ended
    expect(child.stdout.pipe).toHaveBeenCalledWith(out, { end: false });
    expect(child.stderr.pipe).toHaveBeenCalledWith(out, { end: false });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('electron_version: 12.0.1'),
    );
  });

  it('hides the debug output if showConfig is false', async () => {
    const { runner } = await createRunner();
    fakeChild();
    const write = vi.fn();
    await runner.spawn('12.0.1', fiddle, {
      out: { write } as Pick<Writable, 'write'> as Writable,
      showConfig: false,
    });
    expect(write).not.toHaveBeenCalled();
  });

  it('uses `not-installed` for an unknown Electron', async () => {
    const { runner, install } = await createRunner();
    await expect(runner.spawn('99.0.0', fiddle, quiet)).rejects.toHaveProperty(
      'code',
      'not-installed',
    );
    expect(install).not.toHaveBeenCalled();
  });

  describe('inspect', () => {
    it('passes --inspect=127.0.0.1:0 by default, published only on stderr', async () => {
      const { runner } = await createRunner();
      fakeChild();
      await runner.spawn('12.0.1', fiddle, { ...quiet, inspect: {} });
      expect(spawnCall().args).toStrictEqual([
        '--inspect=127.0.0.1:0',
        '--inspect-publish-uid=stderr',
        fiddle.mainPath,
      ]);
    });

    it('puts the inspector flag before user args and the fiddle', async () => {
      const { runner } = await createRunner();
      fakeChild();
      await runner.spawn('12.0.1', fiddle, {
        ...quiet,
        args: ['--enable-logging'],
        inspect: { host: '::1', port: 9229 },
      });
      expect(spawnCall().args).toStrictEqual([
        '--inspect=[::1]:9229',
        '--inspect-publish-uid=stderr',
        '--enable-logging',
        fiddle.mainPath,
      ]);
    });
  });

  it('starts the launcher with Electron and its arguments', async () => {
    const { runner } = await createRunner();
    fakeChild();
    await runner.spawn('12.0.1', fiddle, {
      ...quiet,
      args: ['--no-warnings'],
      launcher: '/path/to/launcher',
    });
    expect(spawnCall()).toMatchObject({
      file: '/path/to/launcher',
      args: [exec, '--no-warnings', fiddle.mainPath],
    });
  });
});
