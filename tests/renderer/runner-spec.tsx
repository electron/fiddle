import { spawn } from 'child_process';
import * as path from 'path';
import * as semver from 'semver';

import { IpcEvents } from '../../src/ipc-events';
import { getIsDownloaded } from '../../src/renderer/binary';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { RunResult } from '../../src/interfaces';
import {
  findModulesInEditors,
  getIsPackageManagerInstalled,
  installModules,
  packageRun,
} from '../../src/renderer/npm';
import { ForgeCommands, Runner } from '../../src/renderer/runner';
import { waitFor } from '../../src/utils/wait-for';
import { AppState } from '../../src/renderer/state';
import { MockChildProcess } from '../mocks/child-process';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';
import { mockVersions, mockVersionsArray } from '../mocks/electron-versions';

jest.mock('../../src/renderer/npm');
jest.mock('../../src/renderer/file-manager');
jest.mock('../../src/renderer/binary', () => ({
  getIsDownloaded: jest.fn(),
  getElectronBinaryPath: jest.fn(),
}));
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('path');

describe('Runner component', () => {
  let mockChild: MockChildProcess;
  let store: any;
  let instance: Runner;

  beforeEach(() => {
    mockChild = new MockChildProcess();
    ipcRendererManager.removeAllListeners();

    (getIsPackageManagerInstalled as jest.Mock).mockReturnValue(true);

    store = {
      version: '2.0.2',
      versions: { ...mockVersions },
      downloadVersion: jest.fn(),
      removeVersion: jest.fn(),
      pushOutput: jest.fn(),
      clearConsole: jest.fn(),
      pushError: jest.fn(),
      packageManager: 'npm',
      get currentElectronVersion() {
        return mockVersions['2.0.2'];
      },
      getName: async () => 'test-app-name',
      setVersion: (version: string) => {
        store.version = version;
        return true;
      },
    };

    (window as any).ElectronFiddle = new ElectronFiddleMock();
    (getIsDownloaded as jest.Mock).mockReturnValue(true);

    instance = new Runner(store as AppState);
  });

  describe('run()', () => {
    it('runs', async () => {
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
      (spawn as any).mockReturnValueOnce(mockChild);

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // child process exits with success
      setTimeout(() => mockChild.emit('close', 0));
      const result = await runPromise;

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.isRunning).toBe(false);
      expect(getIsDownloaded).toHaveBeenCalled();
      expect(
        window.ElectronFiddle.app.fileManager.saveToTemp,
      ).toHaveBeenCalled();
      expect(installModules).toHaveBeenCalled();
    });

    it('runs with logging when enabled', async () => {
      store.isEnablingElectronLogging = true;
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
      (spawn as jest.Mock).mockImplementationOnce((_, __, opts) => {
        expect(opts.env).toHaveProperty('ELECTRON_ENABLE_LOGGING');
        expect(opts.env).toHaveProperty('ELECTRON_ENABLE_STACK_DUMPING');
        return mockChild;
      });

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // child process exits with success
      setTimeout(() => mockChild.emit('close', 0));
      const result = await runPromise;

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.isRunning).toBe(false);
      expect(getIsDownloaded).toHaveBeenCalled();
      expect(
        window.ElectronFiddle.app.fileManager.saveToTemp,
      ).toHaveBeenCalled();
      expect(installModules).toHaveBeenCalled();
    });

    it('emits output with exitCode', async () => {
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
      (spawn as any).mockReturnValueOnce(mockChild);

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // mock child process gives output,
      // then exits with exitCode 0
      mockChild.stdout.emit('data', 'hi');
      mockChild.stderr.emit('data', 'hi');
      mockChild.emit('close', 0);

      const result = await runPromise;

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.isRunning).toBe(false);
      expect(store.pushOutput).toHaveBeenCalledTimes(8);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        'Electron exited with code 0.',
      );
    });

    it('returns failure when app exits nonzero', async () => {
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
      (spawn as any).mockReturnValueOnce(mockChild);
      const ARBITRARY_FAIL_CODE = 50;

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // mock child process exits with ARBITRARY_FAIL_CODE
      mockChild.emit('close', ARBITRARY_FAIL_CODE);
      const result = await runPromise;

      expect(result).toBe(RunResult.FAILURE);
      expect(store.isRunning).toBe(false);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        `Electron exited with code ${ARBITRARY_FAIL_CODE}.`,
      );
    });

    it('emits output without exitCode', async () => {
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
      (spawn as any).mockReturnValueOnce(mockChild);

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // mock child process gives output,
      // then exits without an explicit exitCode
      mockChild.stdout.emit('data', 'hi');
      mockChild.stderr.emit('data', 'hi');
      mockChild.emit('close');
      const result = await runPromise;

      expect(result).toBe(RunResult.INVALID);
      expect(store.isRunning).toBe(false);
      expect(store.pushOutput).toHaveBeenCalledTimes(8);
      expect(store.pushOutput).toHaveBeenLastCalledWith('Electron exited.');
    });

    it('cleans the app data dir after a run', async (done) => {
      // get run() out of the way
      (spawn as any).mockReturnValueOnce(mockChild);
      setTimeout(() => mockChild.emit('close', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      process.nextTick(() => {
        const { cleanup } = window.ElectronFiddle.app.fileManager;
        expect(cleanup).toHaveBeenCalledTimes(2);
        expect(cleanup).toHaveBeenLastCalledWith(
          path.join(`/test-path/test-app-name`),
        );
        done();
      });
    });

    it('does not clean the app data dir after a run if configured', async (done) => {
      (instance as any).appState.isKeepingUserDataDirs = true;

      // get run() out of the way
      (spawn as any).mockReturnValueOnce(mockChild);
      setTimeout(() => mockChild.emit('close', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      process.nextTick(() => {
        const { cleanup } = window.ElectronFiddle.app.fileManager;
        expect(cleanup).toHaveBeenCalledTimes(1);
        done();
      });
    });

    it('automatically cleans the console when enabled', async () => {
      store.isClearingConsoleOnRun = true;
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);

      // get run() out of the way
      (spawn as any).mockReturnValueOnce(mockChild);
      setTimeout(() => mockChild.emit('close', 0));
      const result = await instance.run();

      expect(result).toBe(RunResult.SUCCESS);
      expect(store.clearConsole).toHaveBeenCalled();
    });

    it('does not run version not yet downloaded', async () => {
      (getIsDownloaded as jest.Mock).mockReturnValueOnce(false);

      expect(await instance.run()).toBe(RunResult.INVALID);
    });

    it('does not run if writing files fails', async () => {
      (window.ElectronFiddle.app.fileManager
        .saveToTemp as jest.Mock).mockRejectedValueOnce('bwap bwap');

      expect(await instance.run()).toBe(RunResult.INVALID);
    });

    it('does not run if installing modules fails', async () => {
      const oldError = console.error;
      console.error = jest.fn();

      instance.installModulesForEditor = jest
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error('Bwap-bwap');
        });

      expect(await instance.run()).toBe(RunResult.INVALID);

      console.error = oldError;
    });
  });

  describe('stop()', () => {
    it('stops a running session', async () => {
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
      (spawn as any).mockReturnValueOnce(mockChild);
      mockChild.kill.mockImplementationOnce(() => {
        mockChild.emit('close');
        return true;
      });

      // wait for run() to get running
      const runPromise = instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      // call stop and wait for run() to resolve
      const stopped = instance.stop();
      const runResult = await runPromise;

      expect(stopped).toBe(true);
      expect(runResult).toBe(RunResult.INVALID);
      expect(store.isRunning).toBe(false);
    });

    it('returns failure if killing child process fails', async () => {
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
      (spawn as any).mockReturnValueOnce(mockChild);
      mockChild.kill.mockReturnValueOnce(false);

      // wait for run() to get running
      instance.run();
      await waitFor(() => store.isRunning);
      expect(store.isRunning).toBe(true);

      const stopped = instance.stop();
      expect(stopped).toBe(false);
    });

    it('does nothing if called when idle', () => {
      const stopped = instance.stop();

      expect(stopped).toBe(true);
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
        'Runner: autobisect Electron 2.0.1 - ❓ invalid',
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
      expect(installModules).toHaveBeenCalled();
    });

    it('handles an error', async () => {
      (installModules as jest.Mock).mockRejectedValueOnce('bwap bwap');

      expect(
        await instance.packageInstall({ dir: '', packageManager: 'npm' }),
      ).toBe(false);
      expect(installModules).toHaveBeenCalled();
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
      (installModules as jest.Mock).mockRejectedValueOnce('bwap bwap');

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

  describe('installModulesForEditor()', () => {
    it('does not attempt installation if npm is not installed', async () => {
      (getIsPackageManagerInstalled as jest.Mock).mockReturnValueOnce(false);
      (findModulesInEditors as jest.Mock).mockReturnValueOnce(['fake-module']);

      await instance.installModulesForEditor(
        {
          html: '',
          main: `const a = require('say')`,
          renderer: '',
          preload: '',
          css: '',
        },
        { dir: '/fake/path', packageManager: 'npm' },
      );

      expect(installModules).toHaveBeenCalledTimes(0);
    });

    it('does attempt installation if npm is installed', async () => {
      (getIsPackageManagerInstalled as jest.Mock).mockReturnValueOnce(true);
      (findModulesInEditors as jest.Mock).mockReturnValueOnce(['fake-module']);

      await instance.installModulesForEditor(
        {
          html: '',
          main: `const a = require('say')`,
          renderer: '',
          preload: '',
          css: '',
        },
        { dir: '/fake/path', packageManager: 'npm' },
      );

      expect(installModules).toHaveBeenCalledTimes(1);
    });
  });
});
