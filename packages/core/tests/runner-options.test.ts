import child_process, { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BaseVersions,
  type ErrorMode,
  type FiddleFactory,
  type Installer,
  Runner,
  type RunnerSpawnOptions,
  type TestResult,
} from '../src/index.js';

vi.mock('child_process');

const exec = '/path/to/electron';
const mainPath = '/path/to/fiddle/main.js';
const quiet: RunnerSpawnOptions = { out: undefined, showConfig: false };

async function createRunner(errors?: ErrorMode) {
  const install = vi.fn().mockResolvedValue(exec);
  const create = vi.fn().mockResolvedValue({ source: 'test', mainPath });
  const versions = new BaseVersions([
    '12.0.0',
    '12.0.1',
    '12.0.2',
    '12.0.3',
    '12.0.4',
    '12.0.5',
  ]);
  const runner = await Runner.create({
    installer: { install } as Pick<Installer, 'install'> as Installer,
    fiddleFactory: { create } as Pick<FiddleFactory, 'create'> as FiddleFactory,
    versions,
    errors,
  });
  return { runner, install };
}

function fakeChild(): EventEmitter {
  const child = new EventEmitter();
  vi.mocked(child_process.spawn).mockReturnValue(child as ChildProcess);
  return child;
}

function spawnCall() {
  const [file, args, options] = vi.mocked(child_process.spawn).mock
    .calls[0] as unknown as [string, string[], RunnerSpawnOptions];
  return { file, args, options };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Runner options added in 3.0', () => {
  describe('inspect', () => {
    // @feature run.spawn
    it('passes --inspect=127.0.0.1:0 by default', async () => {
      const { runner } = await createRunner();
      fakeChild();
      await runner.spawn('12.0.1', 'fiddle', { ...quiet, inspect: {} });
      expect(spawnCall().args).toStrictEqual(['--inspect=127.0.0.1:0', mainPath]);
    });

    // @feature run.spawn
    it('puts the inspector flag before user args and the fiddle', async () => {
      const { runner } = await createRunner();
      fakeChild();
      await runner.spawn('12.0.1', 'fiddle', {
        ...quiet,
        args: ['--enable-logging'],
        inspect: { host: '::1', port: 9229 },
      });
      expect(spawnCall().args).toStrictEqual([
        '--inspect=[::1]:9229',
        '--enable-logging',
        mainPath,
      ]);
    });
  });

  describe('childEnv', () => {
    it('builds the environment from `env` minus the denylist, plus user variables', async () => {
      const { runner } = await createRunner();
      fakeChild();
      await runner.spawn('12.0.1', 'fiddle', {
        ...quiet,
        env: { PATH: '/bin', GITHUB_TOKEN: 'secret', LD_PRELOAD: '/evil.so' },
        childEnv: { vars: { FOO: 'bar', DYLD_INSERT_LIBRARIES: '/evil.dylib' } },
      });
      expect(spawnCall().options.env).toStrictEqual({ PATH: '/bin', FOO: 'bar' });
    });

    it('starts from process.env when no `env` is given', async () => {
      vi.stubEnv('GITHUB_TOKEN', 'secret');
      vi.stubEnv('SOME_SETTING', 'kept');
      const { runner } = await createRunner();
      fakeChild();
      await runner.spawn('12.0.1', 'fiddle', { ...quiet, childEnv: {} });
      const { env } = spawnCall().options;
      expect(env).toHaveProperty('SOME_SETTING', 'kept');
      expect(env).not.toHaveProperty('GITHUB_TOKEN');
    });

    it('leaves the spawn options alone when unset', async () => {
      const { runner } = await createRunner();
      fakeChild();
      await runner.spawn('12.0.1', 'fiddle', quiet);
      expect(spawnCall().options).not.toHaveProperty('env');
    });
  });

  describe('signal', () => {
    it('is passed to the installer, and the child gets its own process group', async () => {
      const { runner, install } = await createRunner();
      fakeChild();
      const { signal } = new AbortController();
      await runner.spawn('12.0.1', 'fiddle', { ...quiet, signal });
      expect(install).toHaveBeenCalledWith('12.0.1', { signal });
      const { options } = spawnCall();
      expect(options).not.toHaveProperty('signal');
      expect(options.detached).toBe(process.platform === 'win32' ? undefined : true);
    });

    it('is not passed to the installer when unset', async () => {
      const { runner, install } = await createRunner();
      fakeChild();
      await runner.spawn('12.0.1', 'fiddle', quiet);
      expect(install).toHaveBeenCalledWith('12.0.1');
      expect(spawnCall().options).not.toHaveProperty('detached');
    });

    describe("with errors: 'typed'", () => {
      it('makes run() reject before spawning when already aborted', async () => {
        const { runner, install } = await createRunner('typed');
        const run = runner.run('12.0.1', 'fiddle', {
          ...quiet,
          signal: AbortSignal.abort(),
        });
        await expect(run).rejects.toHaveProperty('code', 'aborted');
        expect(install).not.toHaveBeenCalled();
        expect(child_process.spawn).not.toHaveBeenCalled();
      });

      it('makes run() reject when aborted while the child runs', async () => {
        const { runner } = await createRunner('typed');
        const child = fakeChild();
        const controller = new AbortController();
        const run = runner.run('12.0.1', 'fiddle', {
          ...quiet,
          signal: controller.signal,
        });
        await vi.waitFor(() => expect(child_process.spawn).toHaveBeenCalled());

        controller.abort();
        child.emit('exit', null, 'SIGTERM');
        await expect(run).rejects.toHaveProperty('code', 'aborted');
      });

      it('makes bisect() stop between runs', async () => {
        const { runner } = await createRunner('typed');
        const controller = new AbortController();
        const run = vi.fn(async (): Promise<TestResult> => {
          if (run.mock.calls.length === 2) controller.abort();
          return { status: 'test_passed' };
        });
        runner.run = run;

        const bisect = runner.bisect('12.0.0', '12.0.5', 'fiddle', {
          ...quiet,
          signal: controller.signal,
        });
        await expect(bisect).rejects.toHaveProperty('code', 'aborted');
        expect(run).toHaveBeenCalledTimes(2);
      });
    });

    describe('by default, as in 2.x', () => {
      it('makes run() resolve system_error when already aborted', async () => {
        const { runner } = await createRunner();
        const run = runner.run('12.0.1', 'fiddle', {
          ...quiet,
          signal: AbortSignal.abort(),
        });
        await expect(run).resolves.toStrictEqual({ status: 'system_error' });
        expect(child_process.spawn).not.toHaveBeenCalled();
      });

      it('makes run() resolve system_error when aborted while the child runs', async () => {
        const { runner } = await createRunner();
        const child = fakeChild();
        const controller = new AbortController();
        const run = runner.run('12.0.1', 'fiddle', {
          ...quiet,
          signal: controller.signal,
        });
        await vi.waitFor(() => expect(child_process.spawn).toHaveBeenCalled());

        controller.abort();
        child.emit('exit', null, 'SIGTERM');
        await expect(run).resolves.toStrictEqual({ status: 'system_error' });
      });

      it('makes bisect() resolve system_error', async () => {
        const { runner } = await createRunner();
        const controller = new AbortController();
        const run = vi.fn(async (): Promise<TestResult> => {
          if (run.mock.calls.length === 2) controller.abort();
          return { status: 'test_passed' };
        });
        runner.run = run;

        const bisect = runner.bisect('12.0.0', '12.0.5', 'fiddle', {
          ...quiet,
          signal: controller.signal,
        });
        await expect(bisect).resolves.toStrictEqual({ status: 'system_error' });
        expect(run).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('typed errors', () => {
    it('uses `invalid-fiddle` for an unknown fiddle', async () => {
      const { runner } = await createRunner();
      vi.mocked(
        (runner as unknown as { fiddleFactory: FiddleFactory }).fiddleFactory.create,
      ).mockResolvedValueOnce(undefined);
      await expect(runner.spawn('12.0.1', 'nope', quiet)).rejects.toHaveProperty(
        'code',
        'invalid-fiddle',
      );
    });

    it('uses `not-installed` for an unknown Electron', async () => {
      const { runner } = await createRunner();
      await expect(runner.spawn('99.0.0', 'fiddle', quiet)).rejects.toHaveProperty(
        'code',
        'not-installed',
      );
    });
  });
});
