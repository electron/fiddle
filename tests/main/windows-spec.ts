import {
  getMainWindowOptions, getOrCreateMainWindow, browserWindows
} from '../../src/main/windows';
import { createContextMenu } from '../../src/main/context-menu';
import { resetPlatform, overridePlatform } from '../utils';


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

    afterEach(() => {
      resetPlatform();
    });

    it('returns the expected output on Windows', () => {
      overridePlatform('win32');
      expect(getMainWindowOptions()).toEqual(expectedBase);
    });

    it('returns the expected output on Linux', () => {
      overridePlatform('linux');
      expect(getMainWindowOptions()).toEqual(expectedBase);
    });

    it('returns the expected output on macOS', () => {
      overridePlatform('darwin');
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
