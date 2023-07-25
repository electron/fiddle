import * as electron from 'electron';
import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';

import { isFirstRun } from '../../../src/main/utils/check-first-run';

jest.mock('fs-extra', () => ({
  existsSync: jest.fn(),
  outputFileSync: jest.fn(),
}));

describe('isFirstRun', () => {
  beforeEach(() => {
    mocked(electron.app.getPath).mockReturnValue('path');
  });

  it('reports a non-first run', () => {
    mocked(fs.existsSync).mockReturnValueOnce(true);
    expect(isFirstRun()).toBe(false);
  });

  it('reports a first run', () => {
    mocked(fs.existsSync).mockReturnValueOnce(false);
    expect(isFirstRun()).toBe(true);
    expect(fs.outputFileSync).toHaveBeenCalledTimes(1);
  });

  it('handles an error', () => {
    mocked(fs.existsSync).mockImplementationOnce(() => {
      throw new Error('bwap bwap');
    });

    expect(isFirstRun()).toBe(true);
  });
});
