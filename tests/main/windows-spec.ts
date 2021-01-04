/**
 * @jest-environment node
 */

import { IpcEvents } from '../../src/ipc-events';
import { createContextMenu } from '../../src/main/context-menu';
import { ipcMainManager } from '../../src/main/ipc';
import {
  browserWindows,
  getMainWindowOptions,
  getOrCreateMainWindow,
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
        enableRemoteModule: true,
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        contextIsolation: false,
      },
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
      expect(getMainWindowOptions()).toEqual({
        ...expectedBase,
        titleBarStyle: 'hidden',
      });
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
      (getOrCreateMainWindow() as any).emit('closed');
      expect(browserWindows.length).toBe(0);
    });

    it('creates the context menu on "dom-ready"', () => {
      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      (getOrCreateMainWindow().webContents as any).emit('dom-ready');
      expect(createContextMenu).toHaveBeenCalled();
    });

    it('prevents new-window"', () => {
      const e = {
        preventDefault: jest.fn(),
      };

      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      (getOrCreateMainWindow().webContents as any).emit('new-window', e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('prevents will-navigate"', () => {
      const e = {
        preventDefault: jest.fn(),
      };

      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      (getOrCreateMainWindow().webContents as any).emit('will-navigate', e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('shows the window on IPC event', () => {
      const w = getOrCreateMainWindow();
      ipcMainManager.emit(IpcEvents.SHOW_INACTIVE);
      expect(w.showInactive).toHaveBeenCalled();
    });
  });
});
