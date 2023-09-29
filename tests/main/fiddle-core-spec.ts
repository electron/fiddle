/**
 * @jest-environment node
 */

import { ElectronVersions, Runner } from '@electron/fiddle-core';
import { WebContents } from 'electron';
import { mocked } from 'jest-mock';

import { setupFiddleCore, startFiddle } from '../../src/main/fiddle-core';
import { ChildProcessMock } from '../mocks/child-process';
import { ElectronVersionsMock, FiddleRunnerMock } from '../mocks/fiddle-core';
import { WebContentsMock } from '../mocks/web-contents';

jest.mock('@electron/fiddle-core', () => {
  const { FiddleRunnerMock, InstallerMock } = require('../mocks/fiddle-core');

  return {
    Installer: InstallerMock,
    Runner: FiddleRunnerMock,
  };
});

describe('fiddle-core', () => {
  let runner: FiddleRunnerMock;
  let originalEnv: NodeJS.ProcessEnv;
  const mockEnv = Object.seal({
    PATH: '/path/to/bin/',
  });

  beforeEach(() => {
    runner = new FiddleRunnerMock();
    originalEnv = { ...process.env };
    process.env = mockEnv;
    mocked(Runner.create).mockResolvedValue(runner as unknown as Runner);
    setupFiddleCore(new ElectronVersionsMock() as unknown as ElectronVersions);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('startFiddle', () => {
    const dir = '/path/to/fiddle';
    const version = '18.0.0';

    it('uses provided env', async () => {
      const child = new ChildProcessMock();
      mocked(runner.spawn).mockResolvedValue(child);

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
      mocked(runner.spawn).mockResolvedValue(child);

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
      mocked(runner.spawn).mockResolvedValue(child);

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
  });
});
