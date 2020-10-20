import { spawn } from 'child_process';
import * as path from 'path';

import { IpcEvents } from '../../src/ipc-events';
import { getIsDownloaded } from '../../src/renderer/binary';
import { ipcRendererManager } from '../../src/renderer/ipc';
import {
  findModulesInEditors,
  getIsPackageManagerInstalled,
  installModules,
  packageRun,
} from '../../src/renderer/npm';
import { ForgeCommands, Runner } from '../../src/renderer/runner';
import { AppState } from '../../src/renderer/state';
import { MockChildProcess } from '../mocks/child-process';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';
import { mockVersions } from '../mocks/electron-versions';

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
    };

    (window as any).ElectronFiddle = new ElectronFiddleMock();
    (getIsDownloaded as jest.Mock).mockReturnValue(true);

    instance = new Runner(store as AppState);
  });

  it('runs', async () => {
    (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
    (spawn as any).mockReturnValueOnce(mockChild);

    expect(await instance.run()).toBe(true);
    expect(getIsDownloaded).toHaveBeenCalled();
    expect(window.ElectronFiddle.app.fileManager.saveToTemp).toHaveBeenCalled();
    expect(installModules).toHaveBeenCalled();
    expect(store.isRunning).toBe(true);
  });

  it('runs with logging when enabled', async () => {
    store.isEnablingElectronLogging = true;
    (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
    (spawn as jest.Mock).mockImplementationOnce((_, __, opts) => {
      expect(opts.env).toHaveProperty('ELECTRON_ENABLE_LOGGING');
      expect(opts.env).toHaveProperty('ELECTRON_ENABLE_STACK_DUMPING');
      return mockChild;
    });

    expect(await instance.run()).toBe(true);
    expect(getIsDownloaded).toHaveBeenCalled();
    expect(window.ElectronFiddle.app.fileManager.saveToTemp).toHaveBeenCalled();
    expect(installModules).toHaveBeenCalled();
    expect(store.isRunning).toBe(true);
  });

  it('emits output', async () => {
    (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
    (spawn as any).mockReturnValueOnce(mockChild);

    // Output
    expect(await instance.run()).toBe(true);
    mockChild.stdout.emit('data', 'hi');
    mockChild.stderr.emit('data', 'hi');
    expect(store.pushOutput).toHaveBeenCalledTimes(7);

    // Stop (with code)
    mockChild.emit('close', 0);
    expect(store.pushOutput).toHaveBeenLastCalledWith(
      'Electron exited with code 0.',
    );

    // Stop (without code)
    mockChild.emit('close');
    expect(store.pushOutput).toHaveBeenLastCalledWith('Electron exited.');

    expect(store.isRunning).toBe(false);
  });

  it('stops on close', async () => {
    (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
    (spawn as any).mockReturnValueOnce(mockChild);

    // Stop
    expect(await instance.run()).toBe(true);
    expect(store.isRunning).toBe(true);
    instance.stop();
    expect(store.isRunning).toBe(false);
  });

  it('stops on stop()', async () => {
    (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
    (spawn as any).mockReturnValueOnce(mockChild);

    // Stop
    expect(await instance.run()).toBe(true);
    mockChild.emit('close', 0);
    expect(store.isRunning).toBe(false);
  });

  describe('run()', () => {
    it('cleans the app data dir after a run', async (done) => {
      (spawn as any).mockReturnValueOnce(mockChild);
      expect(await instance.run()).toBe(true);
      mockChild.emit('close', 0);

      process.nextTick(() => {
        expect(
          window.ElectronFiddle.app.fileManager.cleanup,
        ).toHaveBeenCalledTimes(2);
        expect(
          window.ElectronFiddle.app.fileManager.cleanup,
        ).toHaveBeenLastCalledWith(path.join(`/test-path/test-app-name`));
        done();
      });
    });

    it('does not clean the app data dir after a run if configured', async (done) => {
      (instance as any).appState.isKeepingUserDataDirs = true;
      (spawn as any).mockReturnValueOnce(mockChild);
      expect(await instance.run()).toBe(true);
      mockChild.emit('close', 0);

      process.nextTick(() => {
        expect(
          window.ElectronFiddle.app.fileManager.cleanup,
        ).toHaveBeenCalledTimes(1);
        done();
      });
    });

    it('automatically cleans the console when enabled', async () => {
      store.isClearingConsoleOnRun = true;
      (findModulesInEditors as any).mockReturnValueOnce(['fake-module']);
      (spawn as any).mockReturnValueOnce(mockChild);
      expect(await instance.run()).toBe(true);
      expect(store.clearConsole).toHaveBeenCalled();
      mockChild.emit('close', 0);
    });

    it('does not run version not yet downloaded', async () => {
      (getIsDownloaded as jest.Mock).mockReturnValueOnce(false);

      expect(await instance.run()).toBe(false);
    });

    it('does not run if writing files fails', async () => {
      (window.ElectronFiddle.app.fileManager
        .saveToTemp as jest.Mock).mockImplementationOnce(() => {
        throw new Error('bwap bwap');
      });

      expect(await instance.run()).toBe(false);
    });

    it('does not run if installing modules fails', async () => {
      const oldError = console.error;
      console.error = jest.fn();

      instance.installModulesForEditor = jest
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error('Bwap-bwap');
        });

      expect(await instance.run()).toBe(false);

      console.error = oldError;
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
      (installModules as jest.Mock).mockImplementationOnce(() => {
        throw new Error('bwap bwap');
      });

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
      (installModules as jest.Mock).mockImplementationOnce(() => {
        throw new Error('bwap bwap');
      });

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('handles an error in packageRun()', async () => {
      (packageRun as jest.Mock).mockImplementationOnce(() => {
        throw new Error('bwap bwap');
      });

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
