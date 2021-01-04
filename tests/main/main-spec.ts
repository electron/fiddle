/**
 * @jest-environment node
 */

import { app } from 'electron';

import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';
import {
  main,
  onBeforeQuit,
  onReady,
  onWindowsAllClosed,
  setupMenuHandler,
} from '../../src/main/main';
import { shouldQuit } from '../../src/main/squirrel';
import { setupUpdates } from '../../src/main/update';
import { getOrCreateMainWindow } from '../../src/main/windows';
import { setupAboutPanel } from '../../src/main/about-panel';

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

  describe('main()', () => {
    it('quits during Squirrel events', () => {
      (shouldQuit as jest.Mock).mockReturnValueOnce(true);

      main();
      expect(app.quit).toHaveBeenCalledTimes(1);
    });

    it('listens to core events', () => {
      main();
      expect(app.on).toHaveBeenCalledTimes(4);
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
});
