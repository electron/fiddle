import { app } from 'electron';

import { main, onBeforeQuit, onReady, onWindowsAllClosed } from '../../src/main/main';
import { shouldQuit } from '../../src/main/squirrel';
import { setupUpdates } from '../../src/main/update';
import { getOrCreateMainWindow } from '../../src/main/windows';
import { setupAboutPanel } from '../../src/utils/set-about-panel';

jest.mock('../../src/main/windows', () => ({
  getOrCreateMainWindow: jest.fn()
}));

jest.mock('../../src/utils/set-about-panel', () => ({
  setupAboutPanel: jest.fn()
}));

jest.mock('../../src/main/update', () => ({
  setupUpdates: jest.fn()
}));

jest.mock('../../src/main/squirrel', () => ({
  shouldQuit: jest.fn(() => false)
}));

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
      (shouldQuit as jest.Mock).mockReturnValueOnce(true);

      main();
      expect(app.quit).toHaveBeenCalledTimes(1);
    });

    it('listens to core events', () => {
      main();
      expect(app.on).toHaveBeenCalledTimes(5);
    });
  });

  describe('onBeforeQuit()', () => {
    it('sets a global', () => {
      onBeforeQuit();

      expect((global as any).isQuitting).toBe(true);
      (global as any).isQuitting = false;
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
        value: 'darwin'
      });

      onWindowsAllClosed();

      expect(app.quit).toHaveBeenCalledTimes(0);
    });
  });
});
