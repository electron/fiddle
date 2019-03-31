import { setupDevTools } from '../../src/main/devtools';

let mockIsDevMode = false;

jest.mock('../../src/utils/devmode', () => ({
  get isDevMode() {
    return mockIsDevMode;
  }
}));

jest.mock('electron-devtools-installer', () => ({
  default: jest.fn(),
  REACT_DEVELOPER_TOOLS: 'REACT_DEVELOPER_TOOLS',
  REACT_PERF: 'REACT_PERF'
}));

describe('devtools', () => {
  it('does not set up developer tools if not in dev mode', () => {
    const devtools = require('electron-devtools-installer');

    setupDevTools();

    expect(devtools.default).toHaveBeenCalledTimes(0);
  });

  it('sets up developer tools if not in dev mode', () => {
    const devtools = require('electron-devtools-installer');

    mockIsDevMode = true;
    setupDevTools();

    expect(devtools.default).toHaveBeenCalledTimes(1);
  });
});
