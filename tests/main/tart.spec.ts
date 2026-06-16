/**
 * @vitest-environment node
 */

import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isTartAvailable, spawnInVM } from '../../src/main/tart';
import { ChildProcessMock } from '../mocks/child-process';

const { spawnMock, execFileMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  execFileMock: vi.fn(),
}));

// vi.mock is hoisted above the imports above, so the tart module picks up
// these mocked child_process functions.
vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

function setPlatform(value: string) {
  Object.defineProperty(process, 'platform', { value });
}

describe('tart', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: every `execFile` call succeeds. `tart ip` returns an address.
    execFileMock.mockImplementation(
      (cmd: string, args: string[], cb: (e: unknown, r: unknown) => void) => {
        const stdout = args[0] === 'ip' ? '1.2.3.4\n' : '';
        cb(null, { stdout, stderr: '' });
      },
    );
    spawnMock.mockImplementation(() => new ChildProcessMock());
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  describe('isTartAvailable()', () => {
    it('returns false off macOS without shelling out', async () => {
      setPlatform('linux');
      expect(await isTartAvailable()).toBe(false);
      expect(execFileMock).not.toHaveBeenCalled();
    });

    it('returns true on macOS when `tart --version` succeeds', async () => {
      setPlatform('darwin');
      expect(await isTartAvailable()).toBe(true);
    });

    it('returns false on macOS when `tart` is missing', async () => {
      setPlatform('darwin');
      execFileMock.mockImplementation(
        (_cmd: string, _args: string[], cb: (e: unknown) => void) =>
          cb(new Error('not found')),
      );
      expect(await isTartAvailable()).toBe(false);
    });
  });

  describe('spawnInVM()', () => {
    const baseOpts = {
      image: 'my/image:latest',
      fiddleDir: '/tmp/fiddle',
      electronDir: '/install/18.0.0',
      execPath: '/install/18.0.0/electron',
      flags: ['--inspect', '--foo'],
      env: { FOO: 'bar' },
    };

    it('throws off macOS', async () => {
      setPlatform('linux');
      await expect(spawnInVM(baseOpts)).rejects.toThrow('only supported');
    });

    it('clones, boots, and runs the fiddle over SSH', async () => {
      setPlatform('darwin');

      const ssh = await spawnInVM(baseOpts);
      expect(ssh).toBeInstanceOf(EventEmitter);

      const commands = execFileMock.mock.calls.map((call: any[]) => call[1][0]);
      expect(commands).toContain('clone');
      expect(commands).toContain('ip');

      // `tart run` is spawned (long-lived), then ssh via sshpass.
      const spawnCommands = spawnMock.mock.calls.map(([cmd]) => cmd);
      expect(spawnCommands).toEqual(['tart', 'sshpass']);

      const sshArgs = spawnMock.mock.calls[1][1] as string[];
      const remoteCommand = sshArgs[sshArgs.length - 1];
      expect(remoteCommand).toContain(
        `'/Volumes/My Shared Files/electron/electron'`,
      );
      expect(remoteCommand).toContain(`cd '/Volumes/My Shared Files/fiddle'`);
      expect(remoteCommand).toContain(`export FOO='bar'`);
      expect(remoteCommand).toContain(`'--inspect' '--foo'`);
    });

    it('tears the VM down once the SSH session closes', async () => {
      setPlatform('darwin');

      const ssh = (await spawnInVM(baseOpts)) as unknown as ChildProcessMock;
      execFileMock.mockClear();

      ssh.emit('close', 0, null);
      // Allow the async teardown to run.
      await new Promise((resolve) => setImmediate(resolve));

      const commands = execFileMock.mock.calls.map((call: any[]) => call[1][0]);
      expect(commands).toContain('stop');
      expect(commands).toContain('delete');
    });

    it('tears the VM down if booting fails', async () => {
      setPlatform('darwin');
      // Make `tart ip` time out (empty address).
      execFileMock.mockImplementation(
        (cmd: string, args: string[], cb: (e: unknown, r: unknown) => void) => {
          const stdout = args[0] === 'ip' ? '' : '';
          cb(null, { stdout, stderr: '' });
        },
      );

      await expect(spawnInVM(baseOpts)).rejects.toThrow('Timed out');

      const commands = execFileMock.mock.calls.map((call: any[]) => call[1][0]);
      expect(commands).toContain('delete');
    });
  });
});
