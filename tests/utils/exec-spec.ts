jest.mock('child_process');

const mockFixPath = jest.fn();
jest.mock('fix-path', () => mockFixPath);

describe('exec', () => {
  const oldPlatform = process.platform;

  // Allow us to reset the module between each run
  let execModule = require('../../src/utils/exec');

  beforeEach(() => {
    jest.resetModules();
    execModule = require('../../src/utils/exec');
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: oldPlatform
    });
  });

  describe('exec()', () => {
    it('executes a given string', async () => {
      const cpExec = require('child_process').exec;
      cpExec.mockImplementation((_a: any, _b: any, c: any) => c(null, Buffer.from('hi')));

      const result = await execModule.exec('a/dir', 'echo hi');
      const call = cpExec.mock.calls[0];

      expect(call[0]).toBe('echo hi');
      expect(call[1]).toEqual({ cwd: 'a/dir', maxBuffer: 20480000 });
      expect(result).toBe('hi');
    });

    it('handles a returned string', async () => {
      const cpExec = require('child_process').exec;
      cpExec.mockImplementation((_a: any, _b: any, c: any) => c(null, 'hi'));

      const result = await execModule.exec('a/dir', 'echo hi');
      expect(result).toBe('hi');
    });

    it('handles errors', async () => {
      let errored = false;
      const cpExec = require('child_process').exec;
      (cpExec as jest.Mock<any>).mockImplementation((_a: any, _b: any, c: any) => c(new Error('Poop!')));

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
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });

      await execModule.maybeFixPath();

      expect(mockFixPath).toHaveBeenCalledTimes(0);
    });

    it('does call fix-path on macOS', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      await execModule.maybeFixPath();

      expect(mockFixPath).toHaveBeenCalledTimes(1);
    });
  });
});
