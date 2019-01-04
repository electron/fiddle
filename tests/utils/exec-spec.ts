import { exec } from '../../src/utils/exec';

jest.mock('child_process');

jest.mock('fix-path', async () => {
  return {
    default: jest.fn()
  };
});


describe('exec', () => {
  it('executes a given string', async () => {
    const cpExec = require('child_process').exec;
    cpExec.mockImplementation((_a: any, _b: any, c: any) => c(null, Buffer.from('hi')));

    const result = await exec('a/dir', 'echo hi');
    const call = cpExec.mock.calls[0];

    expect(call[0]).toBe('echo hi');
    expect(call[1]).toEqual({ cwd: 'a/dir', maxBuffer: 20480000 });
    expect(result).toBe('hi');
  });

  it('handles a returned string', async () => {
    const cpExec = require('child_process').exec;
    cpExec.mockImplementation((_a: any, _b: any, c: any) => c(null, 'hi'));

    const result = await exec('a/dir', 'echo hi');
    expect(result).toBe('hi');
  });

  it('handles errors', async () => {
    let errored = false;
    const cpExec = require('child_process').exec;
    (cpExec as jest.Mock<any>).mockImplementation((_a: any, _b: any, c: any) => c(new Error('Poop!')));

    try {
      await exec('a/dir', 'echo hi');
    } catch (error) {
      errored = true;
    }

    expect(errored).toBe(true);
  });
});
