/**
 * @jest-environment node
 */

import * as path from 'path';

import { app } from 'electron';

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
jest.mock('path');

describe('windows', () => {
  beforeAll(() => {
    overridePlatform('win32');
  });

  afterAll(() => {
    resetPlatform();
  });

  describe('getMainWindowOptions()', () => {
    const expectedBase = {
      width: 1400,
      height: 900,
      minHeight: 600,
      minWidth: 600,
      acceptFirstMouse: true,
      backgroundColor: '#1d2427',
      show: false,
      titleBarOverlay: false,
      titleBarStyle: undefined,
      trafficLightPosition: {
        x: 20,
        y: 17,
      },
      webPreferences: {
        webviewTag: false,
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        preload: '/fake/path',
      },
    };

    beforeEach(() => {
      (path.join as jest.Mock).mockReturnValue('/fake/path');
    });

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
        titleBarOverlay: true,
        titleBarStyle: 'hiddenInset',
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

    // FIXME: new test for setWindowOpenHandler
    it.skip('prevents new-window"', () => {
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

    it('returns app.getPath() values on IPC event', () => {
      // we want to remove the effects of previous calls
      browserWindows.length = 0;

      // can't .emit() to trigger .handleOnce() so instead we mock
      // to instantly call the listener.
      const event: any = {};
      jest
        .spyOn(ipcMainManager, 'on')
        .mockImplementation((channel, listener) => {
          if (channel === IpcEvents.GET_APP_PATHS) {
            listener(event);
          }
          return ipcMainManager;
        });
      (app.getPath as jest.Mock).mockImplementation((name) => name);
      getOrCreateMainWindow();
      expect(Object.values(event.returnValue).length).toBeGreaterThan(0);
      for (const prop in event.returnValue) {
        expect(prop).toBe(event.returnValue[prop]);
      }
    });
  });
});
