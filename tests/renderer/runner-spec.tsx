import * as path from 'path';

import { InstallState } from '@electron/fiddle-core';
import * as semver from 'semver';

import {
  RunResult,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { ipcRendererManager } from '../../src/renderer/ipc';
import {
  addModules,
  getIsPackageManagerInstalled,
  packageRun,
} from '../../src/renderer/npm';
import { ForgeCommands, Runner } from '../../src/renderer/runner';
import { AppState } from '../../src/renderer/state';
import {
  AppMock,
  FileManagerMock,
  StateMock,
  VersionsMock,
} from '../mocks/mocks';
import { waitFor } from '../utils';

jest.mock('../../src/renderer/npm');
jest.mock('../../src/renderer/file-manager');
jest.mock('fs-extra');
jest.mock('path');

describe('Runner component', () => {
  let store: StateMock;
  let instance: any;
  let fileManager: FileManagerMock;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new VersionsMock());
    ({ fileManager, state: store } = (window.ElectronFiddle
      .app as unknown) as AppMock);
    store.initVersions('2.0.2', { ...mockVersions });
    store.getName.mockResolvedValue('test-app-name');
    store.modules = new Map<string, string>([['cow', '*']]);

    ipcRendererManager.removeAllListeners();

    (getIsPackageManagerInstalled as jest.Mock).mockReturnValue(true);

    instance = new Runner((store as unknown) as AppState);
  });

  describe('run()', () => {
    it('runs', async () => {
      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // child process exits with success
      setTimeout(() => store.versionRunner.child.emit('close', 0));
      const result = await runPromise;

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.isRunning).toBe(false);
      expect(fileManager.saveToTemp).toHaveBeenCalled();
      expect(addModules).toHaveBeenCalled();
    });

    it('runs with logging when enabled', async () => {
      store.isEnablingElectronLogging = true;
      const spyChildProcess = jest.spyOn(store.versionRunner, 'spawn');
      (spyChildProcess as jest.Mock).mockImplementationOnce((_, __, opts) => {
        expect(opts.env).toHaveProperty('ELECTRON_ENABLE_LOGGING');
        expect(opts.env).toHaveProperty('ELECTRON_ENABLE_STACK_DUMPING');
        return store.versionRunner.child;
      });

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // child process exits with success
      setTimeout(() => store.versionRunner.child.emit('close', 0));
      const result = await runPromise;

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.isRunning).toBe(false);
      expect(fileManager.saveToTemp).toHaveBeenCalled();
      expect(addModules).toHaveBeenCalled();
    });

    it('emits output with exitCode', async () => {
      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // mock child process gives output,
      // then exits with exitCode 0
      store.versionRunner.child.stdout.emit('data', 'hi');
      store.versionRunner.child.stderr.emit('data', 'hi');
      store.versionRunner.child.emit('close', 0);

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

      // mock child process exits with ARBITRARY_FAIL_CODE
      store.versionRunner.child.emit('close', ARBITRARY_FAIL_CODE);
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

      // mock child process gives output,
      // then exits without an explicit exitCode
      store.versionRunner.child.stdout.emit('data', 'hi');
      store.versionRunner.child.stderr.emit('data', 'hi');
      store.versionRunner.child.emit('close', null, signal);
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
      setTimeout(() => store.versionRunner.child.emit('close', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      await process.nextTick;
      const { cleanup } = fileManager;
      expect(cleanup).toHaveBeenCalledTimes(2);
      expect(cleanup).toHaveBeenLastCalledWith(
        path.join(`/test-path/test-app-name`),
      );
    });

    it('does not clean the app data dir after a run if configured', async () => {
      (instance as any).appState.isKeepingUserDataDirs = true;

      setTimeout(() => store.versionRunner.child.emit('close', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      await process.nextTick;
      const { cleanup } = fileManager;
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('automatically cleans the console when enabled', async () => {
      store.isClearingConsoleOnRun = true;

      setTimeout(() => store.versionRunner.child.emit('close', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.clearConsole).toHaveBeenCalled();
    });

    it('does not run version not yet downloaded', async () => {
      store.currentElectronVersion.state = InstallState.missing;
      expect(await instance.run()).toBe(RunResult.INVALID);
    });

    it('does not run if writing files fails', async () => {
      (fileManager.saveToTemp as jest.Mock).mockRejectedValueOnce('bwap bwap');

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
      store.versionRunner.child.kill.mockImplementationOnce(() => {
        store.versionRunner.child.emit('close');
        return true;
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

    it('fails if killing child process fails', async () => {
      store.versionRunner.child.kill.mockReturnValueOnce(false);

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
      expect((store.setVersion as jest.Mock).mock.calls).toHaveLength(2);
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
      expect(store.pushOutput).toHaveBeenCalled();
      expect((store.pushOutput as jest.Mock).mock.calls.pop()[0]).toMatch(
        'both returned',
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
      expect(addModules).toHaveBeenCalled();
    });

    it('handles an error', async () => {
      (addModules as jest.Mock).mockRejectedValueOnce('bwap bwap');

      expect(
        await instance.packageInstall({ dir: '', packageManager: 'npm' }),
      ).toBe(false);
      expect(addModules).toHaveBeenCalled();
    });
  });

  describe('performForgeOperation()', () => {
    it('runs in response to an IPC event', () => {
      instance.performForgeOperation = jest.fn();
      ipcRendererManager.emit(IpcEvents.FIDDLE_PACKAGE);
      expect(instance.performForgeOperation).toHaveBeenCalledTimes(1);

      ipcRendererManager.emit(IpcEvents.FIDDLE_MAKE);
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
      (instance as any).saveToTemp = jest.fn();

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('handles an error in packageInstall()', async () => {
      (addModules as jest.Mock).mockRejectedValueOnce('bwap bwap');

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('handles an error in packageRun()', async () => {
      (packageRun as jest.Mock).mockRejectedValueOnce('bwap bwap');

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('does attempt a forge operation if npm is not installed', async () => {
      (getIsPackageManagerInstalled as jest.Mock).mockReturnValueOnce(false);

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
      (getIsPackageManagerInstalled as jest.Mock).mockReturnValue(haveNpm);
      await instance.installModules({
        dir: '/fake/path',
        packageManager: 'npm',
      });

      expect(addModules).toHaveBeenCalledTimes(numCalls);
    });
  });
});
