import { setupDevTools } from '../../src/main/devtools';
import { isDevMode } from '../../src/utils/devmode';
jest.mock('../../src/utils/devmode');

jest.mock('electron-devtools-installer', () => ({
  default: jest.fn(),
  REACT_DEVELOPER_TOOLS: 'REACT_DEVELOPER_TOOLS',
  REACT_PERF: 'REACT_PERF'
}));

describe('devtools', () => {
  it('does not set up developer tools if not in dev mode', () => {
    const devtools = require('electron-devtools-installer');
    (isDevMode as jest.Mock).mockReturnValue(false);
    setupDevTools();

    expect(devtools.default).toHaveBeenCalledTimes(0);
  });

  it('sets up developer tools if in dev mode', () => {
    const devtools = require('electron-devtools-installer');
    (isDevMode as jest.Mock).mockReturnValue(true);
    setupDevTools();

    expect(devtools.default).toHaveBeenCalledTimes(1);
  });

  it('catch error in setting up developer tools', async (done) => {
    const devtools = require('electron-devtools-installer');
    // throw devtool error
    devtools.default.mockRejectedValue(new Error('devtool error'));
    (isDevMode as jest.Mock).mockReturnValue(true);

    try {
      await setupDevTools();
      done();
    } catch (e) {
      expect(e).toMatch('error');
    }
  });
});
