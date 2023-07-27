/**
 * @jest-environment node
 */

import * as path from 'node:path';

import * as electron from 'electron';
import { mocked } from 'jest-mock';

import { IpcEvents } from '../../src/ipc-events';
import { createContextMenu } from '../../src/main/context-menu';
import {
  browserWindows,
  getMainWindowOptions,
  getOrCreateMainWindow,
} from '../../src/main/windows';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/main/context-menu');
jest.mock('node:path');

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
        contextIsolation: false,
        preload: '/fake/path',
      },
    };

    beforeEach(() => {
      mocked(path.join).mockReturnValue('/fake/path');
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
      getOrCreateMainWindow().emit('closed');
      expect(browserWindows.length).toBe(0);
    });

    it('creates the context menu on "dom-ready"', () => {
      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      getOrCreateMainWindow().webContents.emit('dom-ready');
      expect(createContextMenu).toHaveBeenCalled();
    });

    // FIXME: new test for setWindowOpenHandler
    it.skip('prevents new-window"', () => {
      const e = {
        preventDefault: jest.fn(),
      };

      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      getOrCreateMainWindow().webContents.emit('new-window', e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('prevents will-navigate"', () => {
      const e = {
        preventDefault: jest.fn(),
      };

      getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      getOrCreateMainWindow().webContents.emit('will-navigate', e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('returns app.getPath() values on IPC event', () => {
      // we want to remove the effects of previous calls
      browserWindows.length = 0;

      // can't .emit() to trigger .handleOnce() so instead we mock
      // to instantly call the listener.
      let result: Record<string, string> = {};
      mocked(electron.app.getPath).mockImplementation((name) => name);
      mocked(electron.ipcMain.handle).mockImplementation((event, listener) => {
        if (event === IpcEvents.GET_APP_PATHS) {
          result = listener(null as any);
        }
      });
      getOrCreateMainWindow();
      expect(Object.values(result).length).toBeGreaterThan(0);
      for (const prop in result) {
        expect(prop).toBe(result[prop]);
      }
    });
  });
});
