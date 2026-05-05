/**
 * @vitest-environment node
 */

import * as path from 'node:path';

import * as electron from 'electron';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createContextMenu } from '../../src/main/context-menu';
import {
  browserWindows,
  getMainWindowOptions,
  getOrCreateMainWindow,
  mainIsReady,
  safelyOpenWebURL,
} from '../../src/main/windows';
import { overridePlatform, resetPlatform } from '../utils';

vi.mock('../../src/main/context-menu');
vi.mock('node:path');

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
      vi.mocked(path.join).mockReturnValue('/fake/path');
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
    beforeEach(async () => {
      const window = await getOrCreateMainWindow();
      window.emit('closed');
    });

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

    it('sets a window open handler that denies and opens URL externally', async () => {
      await getOrCreateMainWindow();
      const win = browserWindows[0]!;
      const handler = vi.mocked(win.webContents.setWindowOpenHandler).mock
        .calls[0][0];
      const result = handler({
        url: 'https://example.com',
      } as Electron.HandlerDetails);
      expect(result).toEqual({ action: 'deny' });
      expect(electron.shell.openExternal).toHaveBeenCalledWith(
        'https://example.com',
      );
    });

    it('prevents will-navigate"', async () => {
      const e = {
        preventDefault: vi.fn(),
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
