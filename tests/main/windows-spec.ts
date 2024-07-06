/**
 * @jest-environment node
 */

import * as path from 'node:path';

import * as electron from 'electron';
import { mocked } from 'jest-mock';

import { createContextMenu } from '../../src/main/context-menu';
import {
  browserWindows,
  getMainWindowOptions,
  getOrCreateMainWindow,
  mainIsReady,
  safelyOpenWebURL,
} from '../../src/main/windows';
import { overridePlatform, resetPlatform } from '../utils';

jest.mock('../../src/main/context-menu');
jest.mock('node:path');

describe('windows', () => {
  beforeAll(() => {
    mainIsReady();
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
    it('creates a window on first call', async () => {
      expect(browserWindows.length).toBe(0);
      await getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
    });

    it('updates "browserWindows" on "close"', async () => {
      await getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      (await getOrCreateMainWindow()).emit('closed');
      expect(browserWindows.length).toBe(0);
    });

    it('creates the context menu on "dom-ready"', async () => {
      await getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      (await getOrCreateMainWindow()).webContents.emit('dom-ready');
      expect(createContextMenu).toHaveBeenCalled();
    });

    // FIXME: new test for setWindowOpenHandler
    it.skip('prevents new-window"', async () => {
      const e = {
        preventDefault: jest.fn(),
      };

      await getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      (await getOrCreateMainWindow()).webContents.emit('new-window', e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('prevents will-navigate"', async () => {
      const e = {
        preventDefault: jest.fn(),
      };

      await getOrCreateMainWindow();
      expect(browserWindows[0]).toBeTruthy();
      (await getOrCreateMainWindow()).webContents.emit('will-navigate', e);
      expect(e.preventDefault).toHaveBeenCalled();
    });
  });

  describe('safelyOpenWebURL()', () => {
    it('opens web URLs', () => {
      const url = 'https://github.com/electron/fiddle';
      safelyOpenWebURL(url);
      expect(electron.shell.openExternal).toHaveBeenCalledWith(url);
    });

    it('does not open file URLs', () => {
      safelyOpenWebURL('file:///fake/path');
      expect(electron.shell.openExternal).not.toHaveBeenCalled();
    });
  });
});
