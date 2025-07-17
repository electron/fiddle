/**
 * @vitest-environment node
 */

import { BrowserWindow, app, systemPreferences } from 'electron';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { IpcEvents } from '../../src/ipc-events';
import { setupAboutPanel } from '../../src/main/about-panel';
import { ipcMainManager } from '../../src/main/ipc';
import {
  main,
  onBeforeQuit,
  onReady,
  onWindowsAllClosed,
  setupMenuHandler,
  setupShowWindow,
  setupTitleBarClickMac,
} from '../../src/main/main';
import { shouldQuit } from '../../src/main/squirrel';
import { setupUpdates } from '../../src/main/update';
import { getOrCreateMainWindow } from '../../src/main/windows';
import { BrowserWindowMock } from '../mocks/browser-window';
import { overridePlatform, resetPlatform } from '../utils';

// Need to mock this out or CI will hit an error due to
// code being run async continuing after the test ends:
// > ReferenceError: You are trying to `import` a file
// > after the test environment has been torn down.
vi.mock('getos');

vi.mock('../../src/main/windows', () => ({
  getOrCreateMainWindow: vi.fn(),
  mainIsReady: vi.fn(),
}));

vi.mock('../../src/main/about-panel', () => ({
  setupAboutPanel: vi.fn(),
}));

vi.mock('../../src/main/update', () => ({
  setupUpdates: vi.fn(),
}));

vi.mock('../../src/main/squirrel', () => ({
  shouldQuit: vi.fn(() => false),
}));

vi.mock('../../src/main/ipc', () => ({
  ipcMainManager: {
    handle: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
  },
}));

/**
 * This test is very basic and some might say that it's
 * just testing that methods are being called as written.
 * That's mostly true - we just want a simple method
 * for CI to know that the app is still opening a window.
 */
describe('main', () => {
  beforeAll(() => {
    overridePlatform('win32');
  });

  afterAll(() => {
    resetPlatform();
  });

  beforeEach(() => {
    vi.mocked(app.getPath).mockImplementation((name) => name);
  });

  describe('main()', () => {
    afterAll(async () => {
      // main() has some dynamic imports, so ensure that they are resolved
      // before we move on to other tests, otherwise side effects can happen
      await vi.dynamicImportSettled();
    });

    it('quits during Squirrel events', () => {
      vi.mocked(shouldQuit).mockReturnValueOnce(true);

      main([]);
      expect(app.quit).toHaveBeenCalledTimes(1);
    });

    it('listens to core events', async () => {
      main([]);
      expect(app.on).toHaveBeenCalledTimes(6);
    });
  });

  describe('onBeforeQuit()', () => {
    it('sets up IPC so app can quit if dialog confirmed', () => {
      onBeforeQuit();
      expect(ipcMainManager.send).toHaveBeenCalledWith(IpcEvents.BEFORE_QUIT);
      expect(ipcMainManager.on).toHaveBeenCalledWith(
        IpcEvents.CONFIRM_QUIT,
        app.quit,
      );
    });
  });

  describe('onReady()', () => {
    it('opens a BrowserWindow, sets up updates', async () => {
      await onReady();
      expect(setupAboutPanel).toHaveBeenCalledTimes(1);
      expect(getOrCreateMainWindow).toHaveBeenCalled();
      expect(setupUpdates).toHaveBeenCalledTimes(1);
    });
  });

  describe('onWindowsAllClosed()', () => {
    it('quits the app on Windows', () => {
      onWindowsAllClosed();

      expect(app.quit).toHaveBeenCalledTimes(1);
    });

    it('does not quit the app on macOS', () => {
      overridePlatform('darwin');

      onWindowsAllClosed();

      expect(app.quit).toHaveBeenCalledTimes(0);
    });
  });

  describe('setupMenuHandler()', () => {
    it('check if listening on BLOCK_ACCELERATORS', () => {
      setupMenuHandler();

      expect(ipcMainManager.on).toHaveBeenCalledWith(
        IpcEvents.BLOCK_ACCELERATORS,
        expect.anything(),
      );
    });
  });

  describe('setupShowWindow()', () => {
    beforeEach(() => {
      // Since ipcMainManager is mocked, we can't just .emit to trigger
      // the event. Instead, call the callback as soon as the listener
      // is instantiated.
      vi.mocked(ipcMainManager.on).mockImplementationOnce(
        (channel, callback) => {
          if (channel === IpcEvents.SHOW_WINDOW) {
            callback({});
          }
          return ipcMainManager;
        },
      );
    });

    it('shows the window', () => {
      const mockWindow = new BrowserWindowMock();
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(
        mockWindow as unknown as BrowserWindow,
      );
      setupShowWindow();
      expect(mockWindow.show).toHaveBeenCalled();
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
        vi.mocked(ipcMainManager.on).mockImplementationOnce(
          (channel, callback) => {
            if (channel === IpcEvents.CLICK_TITLEBAR_MAC) {
              callback({});
            }
            return ipcMainManager;
          },
        );
      });

      it('should minimize the window if AppleActionOnDoubleClick is minimize', () => {
        const mockWindow = new BrowserWindowMock() as unknown as BrowserWindow;
        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWindow);
        vi.mocked(systemPreferences.getUserDefault).mockReturnValue('Minimize');

        setupTitleBarClickMac();

        expect(mockWindow.minimize).toHaveBeenCalled();
        expect(mockWindow.maximize).not.toHaveBeenCalled();
        expect(mockWindow.unmaximize).not.toHaveBeenCalled();
      });

      it('should maximize the window if AppleActionOnDoubleClick is maximize and the window is not maximized', () => {
        const mockWindow = new BrowserWindowMock();
        vi.mocked(mockWindow.isMaximized).mockReturnValue(false);
        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(
          mockWindow as unknown as BrowserWindow,
        );
        vi.mocked(systemPreferences.getUserDefault).mockReturnValue('Maximize');

        setupTitleBarClickMac();

        expect(mockWindow.minimize).not.toHaveBeenCalled();
        expect(mockWindow.maximize).toHaveBeenCalled();
        expect(mockWindow.unmaximize).not.toHaveBeenCalled();
      });

      it('should unmaximize the window if AppleActionOnDoubleClick is maximize and the window is maximized', () => {
        const mockWindow = new BrowserWindowMock();
        mockWindow.isMaximized.mockReturnValue(true);
        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(
          mockWindow as unknown as BrowserWindow,
        );
        vi.mocked(systemPreferences.getUserDefault).mockReturnValue('Maximize');

        setupTitleBarClickMac();

        expect(mockWindow.minimize).not.toHaveBeenCalled();
        expect(mockWindow.maximize).not.toHaveBeenCalled();
        expect(mockWindow.unmaximize).toHaveBeenCalled();
      });

      it('should do nothing if AppleActionOnDoubleClick is an unknown value', () => {
        const mockWindow = new BrowserWindowMock();
        vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(
          mockWindow as unknown as BrowserWindow,
        );
        vi.mocked(systemPreferences.getUserDefault).mockReturnValue(
          undefined as any,
        );
        setupTitleBarClickMac();
        expect(mockWindow.minimize).not.toHaveBeenCalled();
        expect(mockWindow.maximize).not.toHaveBeenCalled();
        expect(mockWindow.unmaximize).not.toHaveBeenCalled();
      });
    });
  });
});
