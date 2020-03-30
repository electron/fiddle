import * as fs from 'fs-extra';

import { isFirstRun } from '../../src/utils/check-first-run';

jest.mock('fs-extra', () => ({
  existsSync: jest.fn(),
  outputFileSync: jest.fn()
}));

describe('isFirstRun', () => {
  it('reports a first run', () => {
    (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
    expect(isFirstRun()).toBe(false);
  });

  it('reports a first run', () => {
    (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
    expect(isFirstRun()).toBe(true);
    expect(fs.outputFileSync as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('handles an error', () => {
    (fs.existsSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bwap bwap');
    });

    expect(isFirstRun()).toBe(true);
  });
});
