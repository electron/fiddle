import {
  getMainWindowOptions, getOrCreateMainWindow, browserWindows
} from '../../src/main/windows';
import { createContextMenu } from '../../src/main/context-menu';


jest.mock('electron', () => require('../mocks/electron'));
jest.mock('../../src/main/context-menu');

describe('windows', () => {
  describe('getMainWindowOptions()', () => {
    const expectedBase = {
      width: 1200,
      height: 900,
      minHeight: 600,
      minWidth: 600,
      acceptFirstMouse: true,
      backgroundColor: '#1d2427'
    };

    const platform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: platform,
        writable: true
      });
    });

    it('returns the expected output on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      expect(getMainWindowOptions()).toEqual(expectedBase);
    });

    it('returns the expected output on Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      expect(getMainWindowOptions()).toEqual(expectedBase);
    });

    it('returns the expected output on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      expect(getMainWindowOptions()).toEqual({ ...expectedBase, titleBarStyle: 'hidden' });
    });
  });

  describe('getOrCreateMainWindow()', () => {
    it('creates a window on first call', () => {
      expect(browserWindows.main).toBe(null);
      getOrCreateMainWindow();
      expect(browserWindows.main).toBeTruthy();
    });

    it('updates "browserWindows" on "close"', () => {
      getOrCreateMainWindow();
      expect(browserWindows.main).toBeTruthy();
      getOrCreateMainWindow().emit('closed');
      expect(browserWindows.main).toBe(null);
    });

    it('creates the context menu on "dom-ready"', () => {
      getOrCreateMainWindow();
      expect(browserWindows.main).toBeTruthy();
      getOrCreateMainWindow().webContents.emit('dom-ready');
      expect(createContextMenu).toHaveBeenCalled();
    });
  });
});
