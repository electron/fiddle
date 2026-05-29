import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InstallState,
  MAIN_MJS,
  RunResult,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import { ForgeCommands, Runner } from '../../src/renderer/runner';
import { AppState } from '../../src/renderer/state';
import { AppMock, StateMock, VersionsMock } from '../mocks/mocks';
import { emitEvent } from '../utils';

vi.mock('../../src/renderer/file-manager');

describe('Runner component', () => {
  let store: StateMock;
  let instance: Runner;
  let mockVersions: Record<string, RunnableVersion>;

  beforeEach(() => {
    ({ mockVersions } = new VersionsMock());
    ({ state: store } = window.app as unknown as AppMock);
    store.initVersions('2.0.2', { ...mockVersions });
    store.getName.mockResolvedValue('test-app-name');
    store.modules = new Map<string, string>([['cow', '*']]);

    vi.mocked(
      window.ElectronFiddle.getIsPackageManagerInstalled,
    ).mockResolvedValue(true);
    vi.mocked(window.ElectronFiddle.getLocalVersionState).mockReturnValue(
      InstallState.installed,
    );
    instance = new Runner(store as unknown as AppState);
  });

  describe('buildChildEnvVars', () => {
    it('fails when the environment variable is invalid', () => {
      store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);
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

  describe('run-fiddle event', () => {
    it('updates UI state when running starts', () => {
      emitEvent('run-fiddle');
      expect(store.isRunning).toBe(true);
      expect(store.isConsoleShowing).toBe(true);
    });

    it('emits output via fiddle-runner-output and exit message via fiddle-stopped', () => {
      emitEvent('run-fiddle');

      // mock fiddle gives output, then exits with exitCode 0
      emitEvent('fiddle-runner-output', 'hi');
      emitEvent('fiddle-runner-output', 'hi');
      emitEvent('fiddle-stopped', 0);

      expect(store.isRunning).toBe(false);
      expect(store.pushOutput).toHaveBeenCalledTimes(3);
      expect(store.flushOutput).toHaveBeenCalledTimes(1);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        'Electron exited with code 0.',
      );
    });

    it('reports a non-zero exit code', () => {
      const ARBITRARY_FAIL_CODE = 50;

      emitEvent('run-fiddle');
      emitEvent('fiddle-stopped', ARBITRARY_FAIL_CODE);

      expect(store.isRunning).toBe(false);
      expect(store.flushOutput).toHaveBeenCalledTimes(1);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        `Electron exited with code ${ARBITRARY_FAIL_CODE}.`,
      );
    });

    it('reports a signal exit when there is no exit code', () => {
      const signal = 'SIGTERM';

      emitEvent('run-fiddle');
      emitEvent('fiddle-runner-output', 'hi');
      emitEvent('fiddle-runner-output', 'hi');
      emitEvent('fiddle-stopped', null, signal);

      expect(store.isRunning).toBe(false);
      expect(store.flushOutput).toHaveBeenCalledTimes(1);
      expect(store.pushOutput).toHaveBeenCalledTimes(3);
      expect(store.pushOutput).toHaveBeenLastCalledWith(
        `Electron exited with signal ${signal}.`,
      );
    });

    it('does not run version not yet downloaded', () => {
      store.currentElectronVersion.state = InstallState.missing;
      vi.mocked(window.ElectronFiddle.getLocalVersionState).mockReturnValue(
        InstallState.missing,
      );

      emitEvent('run-fiddle');

      expect(store.isRunning).toBe(false);
      expect(store.pushOutput).toHaveBeenCalledWith(
        expect.stringContaining('not downloaded yet'),
        expect.objectContaining({ isNotPre: true }),
      );
    });

    it('runs a local build when getLocalVersionState reports installed', () => {
      store.currentElectronVersion = {
        ...store.currentElectronVersion,
        state: InstallState.missing,
        source: VersionSource.local,
      };
      vi.mocked(window.ElectronFiddle.getLocalVersionState).mockReturnValue(
        InstallState.installed,
      );

      emitEvent('run-fiddle');
      expect(store.isRunning).toBe(true);
    });

    it('automatically clears the console when enabled', () => {
      store.isClearingConsoleOnRun = true;
      emitEvent('run-fiddle');
      expect(store.clearConsole).toHaveBeenCalled();
    });

    it('runs in response to the IPC event', () => {
      // Confirm the event listener has been registered for 'run-fiddle'.
      const calls = vi.mocked(window.ElectronFiddle.addEventListener).mock
        .calls;
      expect(calls.some((c) => (c as any[])[0] === 'run-fiddle')).toBe(true);
    });
  });

  describe('getStartFiddleOptions()', () => {
    it('exposes run-time options to the main process', async () => {
      store.isEnablingElectronLogging = true;
      const options = await instance.getStartFiddleOptions();
      expect(options).toEqual(
        expect.objectContaining({ enableElectronLogging: true }),
      );
    });

    it('returns options reflecting the current AppState', async () => {
      store.executionFlags = ['--inspect-brk'];
      (store as any).packageManager = 'npm';
      (store as any).isUsingSocketFirewall = true;
      (store as any).isKeepingUserDataDirs = true;

      const options = await instance.getStartFiddleOptions();
      expect(options).toEqual(
        expect.objectContaining({
          version: '2.0.2',
          executionFlags: ['--inspect-brk'],
          packageManager: 'npm',
          useSocketFirewall: true,
          isKeepingUserDataDirs: true,
        }),
      );
    });

    it('shows a dialog and throws when the current version is unusable', async () => {
      store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);
      store.currentElectronVersion = {
        version: 'test-0',
        localPath: '/i/definitely/do/not/exist',
        state: InstallState.installed,
        source: VersionSource.local,
      } as const;

      const err = `Local Electron build missing for version ${store.currentElectronVersion.version} - please verify it is in the correct location or remove and re-add it.`;
      store.isVersionUsable = vi.fn().mockReturnValueOnce({ err });

      await expect(instance.getStartFiddleOptions()).rejects.toThrow(
        RunResult.INVALID,
      );

      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(err),
      );
    });

    it('rejects ESM main entry on Electron versions older than 28', async () => {
      store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);
      store.currentElectronVersion = {
        version: '27.0.0',
        state: InstallState.installed,
        source: VersionSource.remote,
      } as const;
      store.isVersionUsable = vi.fn().mockReturnValueOnce({
        ver: store.currentElectronVersion,
      });
      store.editorMosaic.mainEntryPointFile = vi.fn(() => MAIN_MJS) as any;

      await expect(instance.getStartFiddleOptions()).rejects.toThrow(
        RunResult.INVALID,
      );

      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringContaining('ESM main entry points'),
      );
    });
  });

  describe('is-auto-bisecting event', () => {
    it('updates AppState.isAutoBisecting when toggled by main', () => {
      emitEvent('is-auto-bisecting', true);
      expect(store.isAutoBisecting).toBe(true);

      emitEvent('is-auto-bisecting', false);
      expect(store.isAutoBisecting).toBe(false);
    });
  });

  describe('onSetVersion handler', () => {
    it('forwards the version to AppState.setVersion', async () => {
      const calls = vi.mocked(window.ElectronFiddle.onSetVersion).mock.calls;
      expect(calls).toHaveLength(1);
      const callback = calls[0][0];

      await callback('2.0.1');

      expect(store.setVersion).toHaveBeenCalledWith('2.0.1');
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
      vi.mocked(window.ElectronFiddle.addModules).mockRejectedValueOnce(
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
      instance.performForgeOperation = vi.fn();
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
      instance.saveToTemp = vi.fn();

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('handles an error in packageInstall()', async () => {
      vi.mocked(window.ElectronFiddle.addModules).mockRejectedValueOnce(
        'bwap bwap',
      );

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('handles an error in packageRun()', async () => {
      vi.mocked(window.ElectronFiddle.packageRun).mockRejectedValueOnce(
        'bwap bwap',
      );

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });

    it('does attempt a forge operation if npm is not installed', async () => {
      vi.mocked(
        window.ElectronFiddle.getIsPackageManagerInstalled,
      ).mockResolvedValueOnce(false);

      expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(
        false,
      );
    });
  });
});
