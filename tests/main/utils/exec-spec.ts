import { mocked } from 'jest-mock';

import { overridePlatform, resetPlatform } from '../../utils';

jest.mock('node:child_process');

const mockShellEnv = jest.fn();
jest.mock('shell-env', () => mockShellEnv);

describe('exec', () => {
  // Allow us to reset the module between each run
  let execModule = require('../../../src/main/utils/exec');

  beforeEach(() => {
    jest.resetModules();
    execModule = require('../../../src/main/utils/exec');
    mockShellEnv.mockResolvedValue({ PATH: '/some/path' });
  });

  afterEach(() => {
    resetPlatform();
  });

  describe('exec()', () => {
    it('executes a given string', async () => {
      const cpExec = require('node:child_process').exec;
      cpExec.mockImplementation((_a: any, _b: any, c: any) =>
        c(null, {
          stdout: 'hi',
          stderr: '',
        }),
      );

      const result = await execModule.exec('a/dir', 'echo hi');

      expect(cpExec).toBeCalledWith(
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
      const cpExec = require('node:child_process').exec;
      cpExec.mockImplementation((_a: any, _b: any, c: any) =>
        c(null, {
          stdout: 'hi',
          stderr: '',
        }),
      );

      const result = await execModule.exec('a/dir', 'echo hi');
      expect(result).toBe('hi');
    });

    it('handles errors', async () => {
      let errored = false;
      const cpExec = require('node:child_process').exec;
      mocked(cpExec).mockImplementation((_a: any, _b: any, c: any) =>
        c(new Error('Poop!')),
      );

      try {
        await execModule.exec('a/dir', 'echo hi');
      } catch (error) {
        errored = true;
      }

      expect(errored).toBe(true);
    });
  });

  describe('maybeFixPath()', () => {
    it('does not do anything on Windows', async () => {
      overridePlatform('win32');

      await execModule.maybeFixPath();

      expect(mockShellEnv).toHaveBeenCalledTimes(0);
    });

    it('calls shell-env on macOS', async () => {
      overridePlatform('darwin');

      await execModule.maybeFixPath();

      expect(mockShellEnv).toHaveBeenCalledTimes(1);
    });

    it('calls shell-env on Linux', async () => {
      overridePlatform('linux');

      await execModule.maybeFixPath();

      expect(mockShellEnv).toHaveBeenCalledTimes(1);
    });
  });
});
