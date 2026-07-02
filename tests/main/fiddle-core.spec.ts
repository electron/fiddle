/**
 * @vitest-environment node
 */

import * as fs from 'node:fs';
import * as os from 'node:os';

import { ElectronVersions, Installer, Runner } from '@electron/fiddle-core';
import * as electron from 'electron';
import { WebContents } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StartFiddleOptions } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import {
  installModules,
  setupFiddleCore,
  startFiddle,
} from '../../src/main/fiddle-core';
import * as filesMod from '../../src/main/files';
import { addModules, getIsPackageManagerInstalled } from '../../src/main/npm';
import { getFiles } from '../../src/main/utils/get-files';
import { ChildProcessMock } from '../mocks/child-process';
import { ElectronVersionsMock, FiddleRunnerMock } from '../mocks/fiddle-core';
import { WebContentsMock } from '../mocks/web-contents';

vi.mock('@electron/fiddle-core', async () => {
  const { FiddleRunnerMock, InstallerMock } = await import(
    '../mocks/fiddle-core.js'
  );

  return {
    Installer: InstallerMock,
    Runner: FiddleRunnerMock,
  };
});

vi.mock('node:fs');

// The refactored startFiddle delegates the heavy lifting to small helper
// modules. Mock them so these tests can focus on the spawn behaviour.
const { TEMP_DIR, getLocalVersionsMock, getStartFiddleOptionsMock } =
  vi.hoisted(() => {
    return {
      TEMP_DIR: require('node:path').join(
        require('node:os').tmpdir(),
        'test-fiddle',
      ),
      getLocalVersionsMock: vi.fn(
        () => [] as Array<{ version: string; localPath: string }>,
      ),
      getStartFiddleOptionsMock: vi.fn(),
    };
  });
vi.mock('../../src/main/files', () => ({
  saveFilesToTemp: vi.fn().mockResolvedValue(TEMP_DIR),
  cleanupDirectory: vi.fn().mockResolvedValue(true),
  deleteUserData: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/main/npm', () => ({
  addModules: vi.fn().mockResolvedValue(''),
  getIsPackageManagerInstalled: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../src/main/utils/get-files', () => ({
  getFiles: vi.fn().mockResolvedValue({
    files: new Map([['package.json', JSON.stringify({ name: 'test-app' })]]),
  }),
}));
vi.mock('../../src/main/versions', () => ({
  getLocalVersions: () => getLocalVersionsMock(),
}));
vi.mock('../../src/main/utils/get-start-fiddle-options', () => ({
  getStartFiddleOptions: (...args: unknown[]) =>
    getStartFiddleOptionsMock(...args),
}));

function makeOptions(
  overrides: Partial<StartFiddleOptions> = {},
): StartFiddleOptions {
  return {
    enableElectronLogging: false,
    env: {},
    executionFlags: [],
    isKeepingUserDataDirs: false,
    modules: [],
    packageManager: 'npm',
    useSocketFirewall: false,
    version: '18.0.0',
    ...overrides,
  };
}

describe('fiddle-core', () => {
  let runner: FiddleRunnerMock;
  let originalEnv: NodeJS.ProcessEnv;
  // Capture real tmpdir before any env mock — on Windows os.tmpdir() reads
  // process.env.TEMP / process.env.TMP, so include them in the mock to keep
  // os.tmpdir() stable after process.env is replaced.
  const REAL_TMPDIR = os.tmpdir();
  const mockEnv = Object.seal({
    PATH: '/path/to/bin/',
    TEMP: REAL_TMPDIR,
    TMP: REAL_TMPDIR,
  });

  beforeEach(() => {
    runner = new FiddleRunnerMock();
    originalEnv = { ...process.env };
    process.env = mockEnv;
    vi.mocked(Runner.create).mockResolvedValue(runner as unknown as Runner);
    setupFiddleCore(new ElectronVersionsMock() as unknown as ElectronVersions);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(filesMod.saveFilesToTemp).mockResolvedValue(TEMP_DIR);
    vi.mocked(filesMod.cleanupDirectory).mockResolvedValue(true);
    vi.mocked(filesMod.deleteUserData).mockResolvedValue();
    vi.mocked(addModules).mockResolvedValue('');
    vi.mocked(getIsPackageManagerInstalled).mockResolvedValue(true);
    vi.mocked(getFiles).mockResolvedValue({
      files: new Map([['package.json', JSON.stringify({ name: 'test-app' })]]),
    });
    getLocalVersionsMock.mockReturnValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('installModules()', () => {
    it('does not attempt installation if npm is not installed', async () => {
      vi.mocked(getIsPackageManagerInstalled).mockResolvedValue(false);
      await expect(
        installModules(
          new WebContentsMock() as unknown as WebContents,
          [['lodash', '4.0.0']],
          {
            dir: '/fake/path',
            packageManager: 'npm',
          },
        ),
      ).rejects.toThrow('Package manager not installed');

      expect(addModules).toHaveBeenCalledTimes(0);
    });

    it('does attempt installation if npm is installed', async () => {
      vi.mocked(getIsPackageManagerInstalled).mockResolvedValue(true);
      await installModules(
        new WebContentsMock() as unknown as WebContents,
        [['lodash', '4.0.0']],
        {
          dir: '/fake/path',
          packageManager: 'npm',
        },
      );

      expect(addModules).toHaveBeenCalledTimes(1);
    });
  });

  describe('startFiddle', () => {
    const version = '18.0.0';

    function mockSpawnWithAutoClose(
      child: ChildProcessMock,
      code: number | null = 0,
      signal: NodeJS.Signals | null = null,
    ) {
      vi.mocked(runner.spawn).mockImplementation(async () => {
        setImmediate(() => child.emit('close', code, signal));
        return child;
      });
    }

    it('uses provided env', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      getStartFiddleOptionsMock.mockResolvedValueOnce(
        makeOptions({ env: { NODE_OPTIONS: '--inspect-brk' } }),
      );

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        TEMP_DIR,
        expect.objectContaining({
          env: {
            ...mockEnv,
            NODE_OPTIONS: '--inspect-brk',
          },
        }),
      );
    });

    it('runs with logging when enabled', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      getStartFiddleOptionsMock.mockResolvedValueOnce(
        makeOptions({ enableElectronLogging: true }),
      );

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        TEMP_DIR,
        expect.objectContaining({
          env: {
            ...mockEnv,
            ELECTRON_DEBUG_NOTIFICATIONS: 'true',
            ELECTRON_ENABLE_LOGGING: 'true',
            ELECTRON_ENABLE_STACK_DUMPING: 'true',
          },
        }),
      );
    });

    it('can set ELECTRON_ENABLE_LOGGING in env', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      getStartFiddleOptionsMock.mockResolvedValueOnce(
        makeOptions({ env: { ELECTRON_ENABLE_LOGGING: 'true' } }),
      );

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        TEMP_DIR,
        expect.objectContaining({
          env: {
            ...mockEnv,
            ELECTRON_ENABLE_LOGGING: 'true',
          },
        }),
      );
    });

    it('strips blocked env keys from the renderer-supplied env', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      getStartFiddleOptionsMock.mockResolvedValueOnce(
        makeOptions({
          env: {
            LD_PRELOAD: '/evil/lib.so',
            DYLD_INSERT_LIBRARIES: '/evil/lib.dylib',
            DYLD_FRAMEWORK_PATH: '/evil/frameworks',
            DYLD_LIBRARY_PATH: '/evil/lib',
            SAFE_VAR: 'allowed',
          },
        }),
      );

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      const spawnEnv = (
        vi.mocked(runner.spawn).mock.calls[0]! as unknown as [
          unknown,
          unknown,
          { env: Record<string, string> },
        ]
      )[2].env;
      expect(spawnEnv).not.toHaveProperty('LD_PRELOAD');
      expect(spawnEnv).not.toHaveProperty('DYLD_INSERT_LIBRARIES');
      expect(spawnEnv).not.toHaveProperty('DYLD_FRAMEWORK_PATH');
      expect(spawnEnv).not.toHaveProperty('DYLD_LIBRARY_PATH');
      expect(spawnEnv['SAFE_VAR']).toBe('allowed');
    });

    it('uses localPath when the version resolves to a local build with an existing executable', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      const localPath = '/some/local/electron';
      const localVersion = '0.0.0-local.123';
      getLocalVersionsMock.mockReturnValueOnce([
        { version: localVersion, localPath },
      ]);
      // InstallerMock.getExecPath returns `${localPath}/electron`
      vi.mocked(fs.existsSync).mockReturnValue(true);
      getStartFiddleOptionsMock.mockResolvedValueOnce(
        makeOptions({ version: localVersion }),
      );

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      expect(Installer.getExecPath).toHaveBeenCalledWith(localPath);
      expect(runner.spawn).toHaveBeenCalledWith(
        `${localPath}/electron`,
        TEMP_DIR,
        expect.anything(),
      );
    });

    it('falls back to version when the local build executable does not exist', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      const localPath = '/nonexistent/electron';
      const localVersion = '0.0.0-local.456';
      getLocalVersionsMock.mockReturnValueOnce([
        { version: localVersion, localPath },
      ]);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      getStartFiddleOptionsMock.mockResolvedValueOnce(
        makeOptions({ version: localVersion }),
      );

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      expect(runner.spawn).toHaveBeenCalledWith(
        localVersion,
        TEMP_DIR,
        expect.anything(),
      );
    });

    it('strips null bytes from execution flags', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      getStartFiddleOptionsMock.mockResolvedValueOnce(
        makeOptions({
          executionFlags: ['safe-flag', 'evil\0flag', '--js-flags=ok'],
        }),
      );

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        TEMP_DIR,
        expect.objectContaining({
          args: [TEMP_DIR, '--inspect', 'safe-flag', '--js-flags=ok'],
        }),
      );
    });

    it('cleans up the temp dir and user data after the child process closes', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      getStartFiddleOptionsMock.mockResolvedValueOnce(makeOptions());

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      expect(filesMod.cleanupDirectory).toHaveBeenCalledWith(TEMP_DIR);
      expect(filesMod.deleteUserData).toHaveBeenCalledWith('test-app');
    });

    it('does not delete user data when isKeepingUserDataDirs is true', async () => {
      const child = new ChildProcessMock();
      mockSpawnWithAutoClose(child);
      getStartFiddleOptionsMock.mockResolvedValueOnce(
        makeOptions({ isKeepingUserDataDirs: true }),
      );

      await startFiddle(new WebContentsMock() as unknown as WebContents);

      expect(filesMod.cleanupDirectory).toHaveBeenCalledWith(TEMP_DIR);
      expect(filesMod.deleteUserData).not.toHaveBeenCalled();
    });

    it('cleans up when saveFilesToTemp fails', async () => {
      getStartFiddleOptionsMock.mockResolvedValueOnce(makeOptions());
      vi.mocked(filesMod.saveFilesToTemp).mockRejectedValueOnce(
        new Error('disk full'),
      );

      await expect(
        startFiddle(new WebContentsMock() as unknown as WebContents),
      ).rejects.toThrow('disk full');

      expect(runner.spawn).not.toHaveBeenCalled();
    });
  });

  describe('START_FIDDLE IPC handler', () => {
    beforeEach(() => {
      // The IpcMainManager wraps every handle() listener with a
      // BrowserWindow guard; make sure that guard finds a window so
      // the wrapper actually delegates to our handler.
      vi.mocked(electron.BrowserWindow.fromWebContents).mockReturnValue(
        {} as electron.BrowserWindow,
      );
    });

    function getStartFiddleHandler() {
      // setupFiddleCore in the outer beforeEach has already wired the
      // handler — pull the most recent registration for START_FIDDLE
      // out of the ipcMain mock.
      const registration = vi
        .mocked(electron.ipcMain.handle)
        .mock.calls.findLast(([channel]) => channel === IpcEvents.START_FIDDLE);
      if (!registration) throw new Error('START_FIDDLE handler not registered');
      return registration[1];
    }

    function makeInvokeEvent(senderUrl: string): electron.IpcMainInvokeEvent {
      const sender = new WebContentsMock() as unknown as WebContents;
      return {
        sender,
        senderFrame: { url: senderUrl } as unknown as electron.WebFrameMain,
      } as electron.IpcMainInvokeEvent;
    }

    it('ignores START_FIDDLE coming from the main app frame', async () => {
      const handler = getStartFiddleHandler();
      // The IpcMainManager's BrowserWindow guard returns the wrapper
      // that delegates to our handler — invoke it directly so the
      // sender-frame URL check is the one being exercised.
      await handler(makeInvokeEvent('http://localhost:3000/main_window/'));

      expect(runner.spawn).not.toHaveBeenCalled();
    });

    it('ignores START_FIDDLE coming from a file:// frame', async () => {
      const handler = getStartFiddleHandler();
      await handler(makeInvokeEvent('file:///some/index.html'));

      expect(runner.spawn).not.toHaveBeenCalled();
    });

    it('ignores START_FIDDLE when there is no sender frame', async () => {
      const handler = getStartFiddleHandler();
      const sender = new WebContentsMock() as unknown as WebContents;
      const event = {
        sender,
        senderFrame: null,
      } as unknown as electron.IpcMainInvokeEvent;
      await handler(event);

      expect(runner.spawn).not.toHaveBeenCalled();
    });

    it('accepts START_FIDDLE coming from the isolated-actions:// protocol', async () => {
      const child = new ChildProcessMock();
      vi.mocked(runner.spawn).mockImplementation(async () => {
        setImmediate(() => child.emit('close', 0, null));
        return child;
      });
      getStartFiddleOptionsMock.mockResolvedValueOnce(makeOptions());

      const handler = getStartFiddleHandler();
      await handler(makeInvokeEvent('isolated-actions://run-button/'));

      expect(runner.spawn).toHaveBeenCalledTimes(1);
    });
  });
});
