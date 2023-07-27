/**
 * @jest-environment node
 */

import { mocked } from 'jest-mock';

import { setupDevTools } from '../../src/main/devtools';
import { isDevMode } from '../../src/main/utils/devmode';

jest.mock('../../src/main/utils/devmode');

jest.mock('electron-devtools-installer', () => ({
  default: jest.fn(),
  REACT_DEVELOPER_TOOLS: 'REACT_DEVELOPER_TOOLS',
  REACT_PERF: 'REACT_PERF',
}));

describe('devtools', () => {
  it('does not set up developer tools if not in dev mode', () => {
    const devtools = require('electron-devtools-installer');
    mocked(isDevMode).mockReturnValue(false);
    setupDevTools();

    expect(devtools.default).toHaveBeenCalledTimes(0);
  });

  it('sets up developer tools if in dev mode', () => {
    const devtools = require('electron-devtools-installer');
    mocked(isDevMode).mockReturnValue(true);
    setupDevTools();

    expect(devtools.default).toHaveBeenCalledTimes(1);
  });

  it('catch error in setting up developer tools', async () => {
    const devtools = require('electron-devtools-installer');
    // throw devtool error
    devtools.default.mockRejectedValue(new Error('devtool error'));
    mocked(isDevMode).mockReturnValue(true);

    try {
      await setupDevTools();
    } catch (e) {
      expect(e).toMatch('error');
    }
  });
});
