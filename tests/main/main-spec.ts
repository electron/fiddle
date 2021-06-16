/**
 * @jest-environment node
 */

import { app, BrowserWindow, systemPreferences } from 'electron';

import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';
import {
  main,
  onBeforeQuit,
  onReady,
  onWindowsAllClosed,
  setupMenuHandler,
  setupTitleBarClickMac,
} from '../../src/main/main';
import { shouldQuit } from '../../src/main/squirrel';
import { setupUpdates } from '../../src/main/update';
import { getOrCreateMainWindow } from '../../src/main/windows';
import { setupAboutPanel } from '../../src/main/about-panel';
import { overridePlatform } from '../utils';
import { BrowserWindowMock } from '../mocks/browser-window';

jest.mock('../../src/main/windows', () => ({
  getOrCreateMainWindow: jest.fn(),
}));

jest.mock('../../src/main/about-panel', () => ({
  setupAboutPanel: jest.fn(),
}));

jest.mock('../../src/main/update', () => ({
  setupUpdates: jest.fn(),
}));

jest.mock('../../src/main/squirrel', () => ({
  shouldQuit: jest.fn(() => false),
}));

jest.mock('../../src/main/ipc');

/**
 * This test is very basic and some might say that it's
 * just testing that methods are being called as written.
 * That's mostly true - we just want a simple method
 * for CI to know that the app is still opening a window.
 */
describe('main', () => {
  const oldPlatform = process.platform;

  beforeAll(() => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', {
      value: oldPlatform,
    });
  });

  beforeEach(() => {
    (app.getPath as jest.Mock).mockImplementation((name) => name);
  });

  describe('main()', () => {
    it('quits during Squirrel events', () => {
      (shouldQuit as jest.Mock).mockReturnValueOnce(true);

      main([]);
      expect(app.quit).toHaveBeenCalledTimes(1);
    });

    it('listens to core events', () => {
      main([]);
      expect(app.on).toHaveBeenCalledTimes(6);
    });
  });

  describe('onBeforeQuit()', () => {
    it('sets up IPC so app can quit if dialog confirmed', () => {
      onBeforeQuit();
      expect(ipcMainManager.send).toHaveBeenCalledWith<any>(
        IpcEvents.BEFORE_QUIT,
      );
      expect(ipcMainManager.on).toHaveBeenCalledWith<any>(
        IpcEvents.CONFIRM_QUIT,
        app.quit,
      );
    });
  });

  describe('onReady()', () => {
    it('opens a BrowserWindow, sets up updates', async () => {
      await onReady();
      expect(setupAboutPanel).toHaveBeenCalledTimes(1);
      expect(getOrCreateMainWindow).toHaveBeenCalledTimes(1);
      expect(setupUpdates).toHaveBeenCalledTimes(1);
    });
  });

  describe('onWindowsAllClosed()', () => {
    it('quits the app on Windows', () => {
      onWindowsAllClosed();

      expect(app.quit).toHaveBeenCalledTimes(1);
    });

    it('does not quit the app on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      onWindowsAllClosed();

      expect(app.quit).toHaveBeenCalledTimes(0);
    });
  });

  describe('setupMenuHandler()', () => {
    it('check if listening on BLOCK_ACCELERATORS', () => {
      setupMenuHandler();

      expect(ipcMainManager.on).toHaveBeenCalledWith<any>(
        IpcEvents.BLOCK_ACCELERATORS,
        expect.anything(),
      );
    });
  });

  describe('setupTitleBarClickMac()', () => {
    it('should do nothing on non-macOS platforms', () => {
      overridePlatform('win32');
      setupTitleBarClickMac();

      expect(ipcMainManager.on).not.toHaveBeenCalled();
    });

    describe('on macOS', () => {
      beforeEach(() => {
        overridePlatform('darwin');
        // Since ipcMainManager is mocked, we can't just .emit to trigger
        // the event. Instead, call the callback as soon as the listener
        // is instantiated.
        (ipcMainManager.on as jest.Mock).mockImplementationOnce(
          (channel, callback) => {
            if (channel === IpcEvents.CLICK_TITLEBAR_MAC) {
              callback({});
            }
          },
        );
      });

      it('should minimize the window if AppleActionOnDoubleClick is minimize', () => {
        const mockWindow = new BrowserWindowMock();
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(
          mockWindow,
        );
        (systemPreferences.getUserDefault as jest.Mock).mockReturnValue(
          'Minimize',
        );

        setupTitleBarClickMac();

        expect(mockWindow.minimize).toHaveBeenCalled();
      });

      it('should minimize the window if AppleActionOnDoubleClick is minimize', () => {
        const mockWindow = new BrowserWindowMock();
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(
          mockWindow,
        );
        (systemPreferences.getUserDefault as jest.Mock).mockReturnValue(
          'Minimize',
        );

        setupTitleBarClickMac();

        expect(mockWindow.minimize).toHaveBeenCalled();
        expect(mockWindow.maximize).not.toHaveBeenCalled();
        expect(mockWindow.unmaximize).not.toHaveBeenCalled();
      });

      it('should maximize the window if AppleActionOnDoubleClick is maximize and the window is not maximized', () => {
        const mockWindow = new BrowserWindowMock();
        mockWindow.isMaximized.mockReturnValue(false);
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(
          mockWindow,
        );
        (systemPreferences.getUserDefault as jest.Mock).mockReturnValue(
          'Maximize',
        );

        setupTitleBarClickMac();

        expect(mockWindow.minimize).not.toHaveBeenCalled();
        expect(mockWindow.maximize).toHaveBeenCalled();
        expect(mockWindow.unmaximize).not.toHaveBeenCalled();
      });

      it('should unmaximize the window if AppleActionOnDoubleClick is maximize and the window is maximized', () => {
        const mockWindow = new BrowserWindowMock();
        mockWindow.isMaximized.mockReturnValue(true);
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(
          mockWindow,
        );
        (systemPreferences.getUserDefault as jest.Mock).mockReturnValue(
          'Maximize',
        );

        setupTitleBarClickMac();

        expect(mockWindow.minimize).not.toHaveBeenCalled();
        expect(mockWindow.maximize).not.toHaveBeenCalled();
        expect(mockWindow.unmaximize).toHaveBeenCalled();
      });

      it('should do nothing if AppleActionOnDoubleClick is an unknown value', () => {
        const mockWindow = new BrowserWindowMock();
        (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(
          mockWindow,
        );
        (systemPreferences.getUserDefault as jest.Mock).mockReturnValue(
          undefined,
        );
        setupTitleBarClickMac();
        expect(mockWindow.minimize).not.toHaveBeenCalled();
        expect(mockWindow.maximize).not.toHaveBeenCalled();
        expect(mockWindow.unmaximize).not.toHaveBeenCalled();
      });
    });
  });
});
