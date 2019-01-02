import { app } from 'electron';

import { main, onReady, onWindowsAllClosed } from '../../src/main/main';
import { setupUpdates } from '../../src/main/update';
import { getOrCreateMainWindow } from '../../src/main/windows';

jest.mock('../../src/main/windows', () => ({
  getOrCreateMainWindow: jest.fn()
}));

jest.mock('../../src/main/update', () => ({
  setupUpdates: jest.fn()
}));

jest.mock('electron-squirrel-startup', () => false);

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
      value: 'win32'
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', {
      value: oldPlatform
    });
  });

  describe('main()', () => {
    it('quits during Squirrel events', () => {
      jest.mock('electron-squirrel-startup', () => true);

      main();
      expect(app.quit).toHaveBeenCalledTimes(1);

      jest.mock('electron-squirrel-startup', () => false);
    });

    it('listens to core events', () => {
      main();
      expect(app.on).toHaveBeenCalledTimes(4);
    });
  });

  describe('onReady()', () => {
    it('opens a BrowserWindow, sets up updates', async () => {
      await onReady();

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
        value: 'darwin'
      });

      onWindowsAllClosed();

      expect(app.quit).toHaveBeenCalledTimes(0);
    });
  });
});
