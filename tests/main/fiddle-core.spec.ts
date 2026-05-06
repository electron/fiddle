/**
 * @vitest-environment node
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { ElectronVersions, Installer, Runner } from '@electron/fiddle-core';
import { WebContents } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupFiddleCore, startFiddle } from '../../src/main/fiddle-core';
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

describe('fiddle-core', () => {
  let runner: FiddleRunnerMock;
  let originalEnv: NodeJS.ProcessEnv;
  const mockEnv = Object.seal({
    PATH: '/path/to/bin/',
  });
  const dir = path.join(os.tmpdir(), 'test-fiddle');

  beforeEach(() => {
    runner = new FiddleRunnerMock();
    originalEnv = { ...process.env };
    process.env = mockEnv;
    vi.mocked(Runner.create).mockResolvedValue(runner as unknown as Runner);
    setupFiddleCore(new ElectronVersionsMock() as unknown as ElectronVersions);
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('startFiddle', () => {
    const version = '18.0.0';

    it('rejects dir outside the temp directory', async () => {
      await expect(
        startFiddle(new WebContentsMock() as unknown as WebContents, {
          dir: '/not/a/tmp/path',
          enableElectronLogging: false,
          env: {},
          isValidBuild: false,
          localPath: undefined,
          options: [],
          version,
        }),
      ).rejects.toThrow('startFiddle: dir must be inside the temp directory');
    });

    it('uses provided env', async () => {
      const child = new ChildProcessMock();
      vi.mocked(runner.spawn).mockResolvedValue(child);

      await startFiddle(new WebContentsMock() as unknown as WebContents, {
        dir,
        enableElectronLogging: false,
        env: {
          NODE_OPTIONS: '--inspect-brk',
        },
        isValidBuild: true,
        localPath: undefined,
        options: [],
        version,
      });

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        dir,
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
      vi.mocked(runner.spawn).mockResolvedValue(child);

      await startFiddle(new WebContentsMock() as unknown as WebContents, {
        dir,
        enableElectronLogging: true,
        env: {},
        isValidBuild: true,
        localPath: undefined,
        options: [],
        version,
      });

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        dir,
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
      vi.mocked(runner.spawn).mockResolvedValue(child);

      await startFiddle(new WebContentsMock() as unknown as WebContents, {
        dir,
        enableElectronLogging: false,
        env: {
          ELECTRON_ENABLE_LOGGING: 'true',
        },
        isValidBuild: true,
        localPath: undefined,
        options: [],
        version,
      });

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        dir,
        expect.objectContaining({
          env: {
            ...mockEnv,
            ELECTRON_ENABLE_LOGGING: 'true',
          },
        }),
      );
    });

    it('strips blocked env keys from params.env', async () => {
      const child = new ChildProcessMock();
      vi.mocked(runner.spawn).mockResolvedValue(child);

      await startFiddle(new WebContentsMock() as unknown as WebContents, {
        dir,
        enableElectronLogging: false,
        env: {
          LD_PRELOAD: '/evil/lib.so',
          DYLD_INSERT_LIBRARIES: '/evil/lib.dylib',
          DYLD_FRAMEWORK_PATH: '/evil/frameworks',
          DYLD_LIBRARY_PATH: '/evil/lib',
          SAFE_VAR: 'allowed',
        },
        isValidBuild: false,
        localPath: undefined,
        options: [],
        version,
      });

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

    it('uses localPath when the resolved executable exists on disk', async () => {
      const child = new ChildProcessMock();
      vi.mocked(runner.spawn).mockResolvedValue(child);
      const localPath = '/some/local/electron';
      // InstallerMock.getExecPath returns `${localPath}/electron`
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await startFiddle(new WebContentsMock() as unknown as WebContents, {
        dir,
        enableElectronLogging: false,
        env: {},
        isValidBuild: true,
        localPath,
        options: [],
        version,
      });

      expect(Installer.getExecPath).toHaveBeenCalledWith(localPath);
      expect(runner.spawn).toHaveBeenCalledWith(
        `${localPath}/electron`,
        dir,
        expect.anything(),
      );
    });

    it('falls back to version when localPath executable does not exist', async () => {
      const child = new ChildProcessMock();
      vi.mocked(runner.spawn).mockResolvedValue(child);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await startFiddle(new WebContentsMock() as unknown as WebContents, {
        dir,
        enableElectronLogging: false,
        env: {},
        isValidBuild: true,
        localPath: '/nonexistent/electron',
        options: [],
        version,
      });

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        dir,
        expect.anything(),
      );
    });

    it('strips null bytes from options', async () => {
      const child = new ChildProcessMock();
      vi.mocked(runner.spawn).mockResolvedValue(child);

      await startFiddle(new WebContentsMock() as unknown as WebContents, {
        dir,
        enableElectronLogging: false,
        env: {},
        isValidBuild: false,
        localPath: undefined,
        options: ['--inspect', 'safe-flag', 'evil\0flag', '--js-flags=ok'],
        version,
      });

      expect(runner.spawn).toHaveBeenCalledWith(
        version,
        dir,
        expect.objectContaining({
          args: ['--inspect', 'safe-flag', '--js-flags=ok'],
        }),
      );
    });
  });
});
