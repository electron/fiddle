import { createContextMenu } from '../../src/main/context-menu';
import {
  browserWindows, getMainWindowOptions, getOrCreateMainWindow
} from '../../src/main/windows';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/main/context-menu');

describe('windows', () => {
  beforeAll(() => {
    overridePlatform('win32');
  });

  afterAll(() => {
    resetPlatform();
  });

  describe('getMainWindowOptions()', () => {
    const expectedBase = {
      width: 1200,
      height: 900,
      minHeight: 600,
      minWidth: 600,
      acceptFirstMouse: true,
      backgroundColor: '#1d2427',
      webPreferences: {
        webviewTag: false,
        nodeIntegration: true
      }
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
      expect(browserWindows.length).toBe(0);
      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
    });

    it('updates "browserWindows" on "close"', () => {
      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      getOrCreateMainWindow().emit('closed');
      expect(browserWindows.length).toBe(0);
    });

    it('creates the context menu on "dom-ready"', () => {
      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      getOrCreateMainWindow().webContents.emit('dom-ready');
      expect(createContextMenu).toHaveBeenCalled();
    });

    it('prevents new-window"', () => {
      const e = {
        preventDefault: jest.fn()
      };

      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      getOrCreateMainWindow().webContents.emit('new-window', e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('prevents will-navigate"', () => {
      const e = {
        preventDefault: jest.fn()
      };

      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      getOrCreateMainWindow().webContents.emit('will-navigate', e);
      expect(e.preventDefault).toHaveBeenCalled();
    });
  });
});
