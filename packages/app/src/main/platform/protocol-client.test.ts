/** Claiming electron-fiddle:// for the packaged app: never in dev or test mode, and on Windows only through the Squirrel stub. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  app: {
    isPackaged: true,
    isDefaultProtocolClient: vi.fn(() => false),
    setAsDefaultProtocolClient: vi.fn(),
  },
  testMode: false,
  stubExists: true,
  warn: vi.fn(),
}));

vi.mock('electron', () => ({ app: mocks.app }));
vi.mock('node:fs', () => ({ default: { existsSync: () => mocks.stubExists } }));
vi.mock('../log', () => ({ log: { warn: mocks.warn } }));
vi.mock('../test-mode', () => ({ isTestMode: () => mocks.testMode }));
vi.mock('./squirrel', () => ({
  PROTOCOL: 'electron-fiddle',
  squirrelStubPath: () => 'C:\\Fiddle\\electron-fiddle.exe',
}));

import { registerProtocolClient } from './protocol-client';

const realPlatform = process.platform;
const windowsStore = (value: boolean | undefined) =>
  Object.defineProperty(process, 'windowsStore', { value, configurable: true });

beforeEach(() => {
  mocks.app.isPackaged = true;
  mocks.testMode = false;
  mocks.stubExists = true;
  mocks.app.isDefaultProtocolClient.mockReset().mockReturnValue(false);
  mocks.app.setAsDefaultProtocolClient.mockReset();
  Object.defineProperty(process, 'platform', { value: 'linux' });
});
afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform });
  windowsStore(undefined);
});

describe('registerProtocolClient', () => {
  it('registers the packaged app, unless it already is the handler', () => {
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).toHaveBeenCalledWith('electron-fiddle');
    mocks.app.isDefaultProtocolClient.mockReturnValue(true);
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).toHaveBeenCalledOnce();
  });

  it('leaves the protocol alone in a dev build and in test mode', () => {
    mocks.app.isPackaged = false;
    registerProtocolClient();
    mocks.app.isPackaged = true;
    mocks.testMode = true;
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });

  it('registers the Squirrel stub on Windows, and nothing for a Store or portable copy', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).toHaveBeenCalledWith(
      'electron-fiddle',
      'C:\\Fiddle\\electron-fiddle.exe',
    );

    mocks.app.setAsDefaultProtocolClient.mockClear();
    mocks.stubExists = false;
    registerProtocolClient();
    mocks.stubExists = true;
    windowsStore(true);
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });

  it('only logs when the OS refuses', () => {
    mocks.app.setAsDefaultProtocolClient.mockImplementation(() => {
      throw new Error('access denied');
    });
    expect(() => registerProtocolClient()).not.toThrow();
    expect(mocks.warn).toHaveBeenCalled();
  });
});
