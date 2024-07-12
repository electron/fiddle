import { mocked } from 'jest-mock';
import * as semver from 'semver';

import {
  InstallState,
  RunResult,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import { ForgeCommands, Runner } from '../../src/renderer/runner';
import { AppState } from '../../src/renderer/state';
import {
  AppMock,
  FileManagerMock,
  StateMock,
  VersionsMock,
} from '../mocks/mocks';
import { emitEvent, waitFor } from '../utils';

jest.mock('../../src/renderer/file-manager');

describe('Runner component', () => {
  let store: StateMock;
  let instance: Runner;
  let fileManager: FileManagerMock;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new VersionsMock());
    ({ fileManager, state: store } = window.app as unknown as AppMock);
    store.initVersions('2.0.2', { ...mockVersions });
    store.getName.mockResolvedValue('test-app-name');
    store.modules = new Map<string, string>([['cow', '*']]);

    mocked(
      window.ElectronFiddle.getIsPackageManagerInstalled,
    ).mockResolvedValue(true);
    mocked(window.ElectronFiddle.deleteUserData).mockResolvedValue();

    instance = new Runner(store as unknown as AppState);
  });

  describe('buildChildEnvVars', () => {
    it('fails when the environment variable is invalid', () => {
      store.showErrorDialog = jest.fn().mockResolvedValueOnce(true);
      store.environmentVariables = ['bwap bwap'];
      const env = instance.buildChildEnvVars();
      expect(env).toEqual({});

      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(
          `Could not parse environment variable: bwap bwap`,
        ),
      );
    });

    it('returns an empty object when there are no environment variables', () => {
      store.environmentVariables = [];
      const env = instance.buildChildEnvVars();
      expect(env).toEqual({});
    });

    it('returns an object with the environment variables', () => {
      store.environmentVariables = ['foo=bar', 'bar=baz'];
      const env = instance.buildChildEnvVars();
      expect(env).toEqual({ foo: 'bar', bar: 'baz' });
    });

    it('returns an object with complex environment variables', () => {
      store.environmentVariables = [
        'NODE_OPTIONS="--no-warnings --max-old-space-size=2048"',
        'ELECTRON_TRASH=gvfs-trash',
        'ELECTRON_OVERRIDE_DIST_PATH=/Users/user=nam=!e/projects/electron/out/Testing',
      ];
      const env = instance.buildChildEnvVars();
      expect(env).toEqual({
        NODE_OPTIONS: '--no-warnings --max-old-space-size=2048',
        ELECTRON_TRASH: 'gvfs-trash',
        ELECTRON_OVERRIDE_DIST_PATH:
          '/Users/user=nam=!e/projects/electron/out/Testing',
      });
    });
  });

  describe('run()', () => {
    it('runs', async () => {
      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // fiddle exits with success
      setTimeout(() => emitEvent('fiddle-stopped', 0));
      const result = await runPromise;

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.isRunning).toBe(false);
      expect(fileManager.saveToTemp).toHaveBeenCalled();
      expect(window.ElectronFiddle.addModules).toHaveBeenCalled();
    });

    it('runs with logging when enabled', async () => {
      store.isEnablingElectronLogging = true;

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // fiddle exits with success
      setTimeout(() => emitEvent('fiddle-stopped', 0));
      const result = await runPromise;

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.isRunning).toBe(false);
      expect(fileManager.saveToTemp).toHaveBeenCalled();
      expect(window.ElectronFiddle.addModules).toHaveBeenCalled();
      expect(window.ElectronFiddle.startFiddle).toBeCalledWith(
        expect.objectContaining({
          enableElectronLogging: true,
        }),
      );
    });

    it('emits output with exitCode', async () => {
      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // mock fiddle gives output,
      // then exits with exitCode 0
      emitEvent('fiddle-runner-output', 'hi');
      emitEvent('fiddle-runner-output', 'hi');
      emitEvent('fiddle-stopped', 0);

      const result = await runPromise;

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.isRunning).toBe(false);
      expect(store.pushOutput).toHaveBeenCalledTimes(8);
      expect(store.flushOutput).toHaveBeenCalledTimes(1);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        'Electron exited with code 0.',
      );
    });

    it('returns failure when app exits nonzero', async () => {
      const ARBITRARY_FAIL_CODE = 50;

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // mock fiddle exits with ARBITRARY_FAIL_CODE
      emitEvent('fiddle-stopped', ARBITRARY_FAIL_CODE);
      const result = await runPromise;

      expect(result).toBe(RunResult.FAILURE);
      expect(store.isRunning).toBe(false);
      expect(store.flushOutput).toHaveBeenCalledTimes(1);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        `Electron exited with code ${ARBITRARY_FAIL_CODE}.`,
      );
    });

    it('shows a dialog and returns invalid when the current version is missing', async () => {
      store.showErrorDialog = jest.fn().mockResolvedValueOnce(true);
      store.currentElectronVersion = {
        version: 'test-0',
        localPath: '/i/definitely/do/not/exist',
        state: InstallState.installed,
        source: VersionSource.local,
      } as const;

      const err = `Local Electron build missing for version ${store.currentElectronVersion.version} - please verify it is in the correct location or remove and re-add it.`;
      store.isVersionUsable = jest.fn().mockReturnValueOnce({ err });

      const result = await instance.run();
      expect(result).toBe(RunResult.INVALID);

      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(err),
      );
    });

    it('emits output without exitCode', async () => {
      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      const signal = 'SIGTERM';

      // mock fiddle gives output,
      // then exits without an explicit exitCode
      emitEvent('fiddle-runner-output', 'hi');
      emitEvent('fiddle-runner-output', 'hi');
      emitEvent('fiddle-stopped', null, signal);
      const result = await runPromise;

      expect(result).toBe(RunResult.FAILURE);
      expect(store.isRunning).toBe(false);
      expect(store.flushOutput).toHaveBeenCalledTimes(1);
      expect(store.pushOutput).toHaveBeenCalledTimes(8);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        `Electron exited with signal ${signal}.`,
      );
    });

    it('cleans the app data dir after a run', async () => {
      setTimeout(() => emitEvent('fiddle-stopped', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      await new Promise(process.nextTick);
      expect(window.ElectronFiddle.cleanupDirectory).toHaveBeenCalledTimes(1);
      expect(window.ElectronFiddle.deleteUserData).toHaveBeenCalledTimes(1);
      expect(window.ElectronFiddle.deleteUserData).toHaveBeenCalledWith(
        'test-app-name',
      );
    });

    it('does not clean the app data dir after a run if configured', async () => {
      (instance as any).appState.isKeepingUserDataDirs = true;

      setTimeout(() => emitEvent('fiddle-stopped', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      await new Promise(process.nextTick);
      expect(window.ElectronFiddle.cleanupDirectory).toHaveBeenCalledTimes(1);
    });

    it('automatically cleans the console when enabled', async () => {
      store.isClearingConsoleOnRun = true;

      setTimeout(() => emitEvent('fiddle-stopped', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.clearConsole).toHaveBeenCalled();
    });

    it('does not run version not yet downloaded', async () => {
      store.currentElectronVersion.state = InstallState.missing;
      expect(await instance.run()).toBe(RunResult.INVALID);
    });

    it('does not run if writing files fails', async () => {
      mocked(fileManager.saveToTemp).mockRejectedValueOnce('bwap bwap');

      expect(await instance.run()).toBe(RunResult.INVALID);
    });

    it('does not run if installing modules fails', async () => {
      const oldError = console.error;
      console.error = jest.fn();

      instance.installModules = jest.fn().mockImplementationOnce(async () => {
        throw new Error('Bwap-bwap');
      });

      expect(await instance.run()).toBe(RunResult.INVALID);

      console.error = oldError;
    });
  });

  describe('stop()', () => {
    it('stops a running session', async () => {
      mocked(window.ElectronFiddle.stopFiddle).mockImplementationOnce(() => {
        emitEvent('fiddle-stopped', RunResult.FAILURE);
      });

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // call stop and wait for run() to resolve
      instance.stop();
      const runResult = await runPromise;

      expect(runResult).toBe(RunResult.FAILURE);
      expect(store.isRunning).toBe(false);
    });

    it('fails if stopping fiddle fails', async () => {
      mocked(window.ElectronFiddle.stopFiddle).mockImplementationOnce(() => {});

      // wait for run() to get running
      instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      instance.stop();
      expect(store.isRunning).toBe(true);
    });
  });

  describe('autobisect()', () => {
    it('returns success if bisection succeeds', async () => {
      // make sure good, bad exist in our mock
      const LAST_GOOD = '2.0.1';
      const FIRST_BAD = '2.0.2';
      expect(mockVersions[LAST_GOOD]).toEqual(expect.anything());
      expect(mockVersions[FIRST_BAD]).toEqual(expect.anything());

      const spy = jest.spyOn(store, 'setVersion');
      instance.run = jest.fn().mockImplementation(() => {
        // test succeeds iff version <= LAST_GOOD
        if (typeof store.version !== 'string') {
          throw new Error(
            'Need to pass version string into this implementation!',
          );
        }
        return semver.compare(store.version, LAST_GOOD) <= 0
          ? RunResult.SUCCESS
          : RunResult.FAILURE;
      });

      const bisectRange = [...mockVersionsArray].reverse();
      const result = await instance.autobisect(bisectRange);

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.setVersion).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, LAST_GOOD);
      expect(spy).toHaveBeenNthCalledWith(2, FIRST_BAD);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        `https://github.com/electron/electron/compare/v${LAST_GOOD}...v${FIRST_BAD}`,
      );

      spy.mockRestore();
    });

    it('returns invalid if unable to run', async () => {
      const spy = jest.spyOn(store, 'setVersion');
      instance.run = jest.fn().mockImplementation(() => RunResult.INVALID);

      const bisectRange = [...mockVersionsArray].reverse();
      const result = await instance.autobisect(bisectRange);

      expect(result).toBe(RunResult.INVALID);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        'Runner: autobisect Electron 2.0.1 - finished test ❓ invalid',
      );

      spy.mockRestore();
    });

    it('returns invalid if not enough versions to bisect', async () => {
      const bisectRange = [mockVersions['2.0.1']];

      const result = await instance.autobisect(bisectRange);

      expect(result).toBe(RunResult.INVALID);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        'Runner: autobisect needs at least two Electron versions',
      );
    });

    async function allRunsReturn(runResult: RunResult) {
      instance.run = jest.fn().mockImplementation(() => runResult);
      const bisectRange = [...mockVersionsArray].reverse();

      const bisectResult = await instance.autobisect(bisectRange);

      expect(bisectResult).toBe(RunResult.INVALID);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        expect.stringMatching('both returned'),
      );
    }

    it('returns invalid if a bad version cannot be found', () => {
      allRunsReturn(RunResult.SUCCESS);
    });

    it('returns invalid if a good version cannot be found', async () => {
      allRunsReturn(RunResult.FAILURE);
    });
  });

  describe('installModules()', () => {
    it('installs modules', async () => {
      expect(
        await instance.packageInstall({ dir: '', packageManager: 'npm' }),
      ).toBe(true);
      expect(window.ElectronFiddle.addModules).toHaveBeenCalled();
    });

    it('handles an error', async () => {
      mocked(window.ElectronFiddle.addModules).mockRejectedValueOnce(
        'bwap bwap',
      );

      expect(
        await instance.packageInstall({ dir: '', packageManager: 'npm' }),
      ).toBe(false);
      expect(window.ElectronFiddle.addModules).toHaveBeenCalled();
    });
  });

  describe('performForgeOperation()', () => {
    it('runs in response to an event', () => {
      instance.performForgeOperation = jest.fn();
      emitEvent('package-fiddle');
      expect(instance.performForgeOperation).toHaveBeenCalledTimes(1);

      emitEvent('make-fiddle');
      expect(instance.performForgeOperation).toHaveBeenCalledTimes(2);
    });

    it('performs a package operation', async () => {
      expect(await instance.performForgeOperation(ForgeCommands.PACKAGE)).toBe(
        true,
      );
    });

    it('performs a make operation', async () => {
      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        true,
      );
    });

    it('handles an error in saveToTemp()', async () => {
      instance.saveToTemp = jest.fn();

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('handles an error in packageInstall()', async () => {
      mocked(window.ElectronFiddle.addModules).mockRejectedValueOnce(
        'bwap bwap',
      );

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('handles an error in packageRun()', async () => {
      mocked(window.ElectronFiddle.packageRun).mockRejectedValueOnce(
        'bwap bwap',
      );

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('does attempt a forge operation if npm is not installed', async () => {
      mocked(
        window.ElectronFiddle.getIsPackageManagerInstalled,
      ).mockResolvedValueOnce(false);

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });
  });

  describe('installModules()', () => {
    it.each([
      ['does not attempt installation if npm is not installed', false, 0],
      ['does attempt installation if npm is installed', true, 1],
    ])('%s', async (_: unknown, haveNpm: boolean, numCalls: number) => {
      mocked(
        window.ElectronFiddle.getIsPackageManagerInstalled,
      ).mockResolvedValue(haveNpm);
      await instance.installModules({
        dir: '/fake/path',
        packageManager: 'npm',
      });

      expect(window.ElectronFiddle.addModules).toHaveBeenCalledTimes(numCalls);
    });
  });
});
