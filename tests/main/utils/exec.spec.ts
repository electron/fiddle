import cp from 'node:child_process';

import shellEnv from 'shell-env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exec } from '../../../src/main/utils/exec';
import { overridePlatform, resetPlatform } from '../../utils';

vi.mock('node:child_process', () => ({
  default: { exec: vi.fn() },
}));

vi.mock('shell-env');

describe('exec', async () => {
  beforeEach(async () => {
    vi.mocked(shellEnv).mockResolvedValue({ PATH: '/some/path' });
  });

  afterEach(() => {
    resetPlatform();
  });

  describe('exec()', () => {
    it('executes a given string', async () => {
      vi.mocked(cp.exec).mockImplementation((_a: any, _b: any, c: any) =>
        c(null, {
          stdout: 'hi',
          stderr: '',
        }),
      );

      const result = await exec('a/dir', 'echo hi');

      expect(cp.exec).toBeCalledWith(
        'echo hi',
        {
          cwd: 'a/dir',
          maxBuffer: 20480000,
        },
        expect.anything(),
      );
      expect(result).toBe('hi');
    });

    it('handles a returned string', async () => {
      vi.mocked(cp.exec).mockImplementation((_a: any, _b: any, c: any) =>
        c(null, {
          stdout: 'hi',
          stderr: '',
        }),
      );

      const result = await exec('a/dir', 'echo hi');
      expect(result).toBe('hi');
    });

    it('handles errors', async () => {
      let errored = false;
      vi.mocked(cp.exec).mockImplementation((_a: any, _b: any, c: any) =>
        c(new Error('Poop!')),
      );

      try {
        await exec('a/dir', 'echo hi');
      } catch (error) {
        errored = true;
      }

      expect(errored).toBe(true);
    });
  });

  describe('maybeFixPath()', () => {
    let maybeFixPath: () => Promise<void>;

    beforeEach(async () => {
      // The module has a singleton, so we need to reset it
      vi.resetModules();
      ({ maybeFixPath } = await import('../../../src/main/utils/exec.js'));
    });

    it('does not do anything on Windows', async () => {
      overridePlatform('win32');

      await maybeFixPath();

      expect(shellEnv).toHaveBeenCalledTimes(0);
    });

    it('calls shell-env on macOS', async () => {
      overridePlatform('darwin');

      await maybeFixPath();

      expect(shellEnv).toHaveBeenCalledTimes(1);
    });

    it('calls shell-env on Linux', async () => {
      overridePlatform('linux');

      await maybeFixPath();

      expect(shellEnv).toHaveBeenCalledTimes(1);
    });
  });
});
