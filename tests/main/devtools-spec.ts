import { setupDevTools } from '../../src/main/devtools';

jest.mock('electron-devtools-installer', () => ({
  default: jest.fn(),
  REACT_DEVELOPER_TOOLS: 'REACT_DEVELOPER_TOOLS',
  REACT_PERF: 'REACT_PERF'
}));

describe('devtools', () => {
  const old = (process as any).defaultApp; // for tsconfig error

  afterEach(() => {
    Object.defineProperty(process, 'defaultApp', { value: old });
  });

  it('does not set up developer tools if not in dev mode', () => {
    const devtools = require('electron-devtools-installer');
    Object.defineProperty(process, 'defaultApp', {
      value: undefined,
      writable: true
    });
    setupDevTools();

    expect(devtools.default).toHaveBeenCalledTimes(0);
  });

  it('sets up developer tools if in dev mode', () => {
    const devtools = require('electron-devtools-installer');

    Object.defineProperty(process, 'defaultApp', {
      value: true,
      writable: true
    });
    setupDevTools();

    expect(devtools.default).toHaveBeenCalledTimes(1);
  });

  it('catch error in setting up developer tools', async (done) => {
    const devtools = require('electron-devtools-installer');
    // throw devtool erros
    devtools.default.mockRejectedValue(new Error('devtool error'));
    Object.defineProperty(process, 'defaultApp', {
      value: true,
      writable: true
    });
    try {
      await setupDevTools();
      done();
    } catch (e) {
      expect(e).toMatch('error');
    }
  });
});
