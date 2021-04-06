/**
 * @jest-environment node
 */
import * as electron from 'electron';
import { IpcEvents } from '../../src/ipc-events';
import { setupGlobalWindow, setupPaths } from '../../src/preload/preload';

describe('preload', () => {
  // We instantiate this in `tests/setup.js` for the main and
  // renderer processes, but we don't need these mocks since
  // these things are being instantiated within the preload
  beforeEach(() => {
    delete (window as any).ElectronFiddle;
  });

  describe('setupGlobalWindow()', () => {
    it('sets up a window.ElectronFiddle object', () => {
      setupGlobalWindow();

      expect((window as any).ElectronFiddle).toMatchObject({
        app: null,
        editors: {
          'main.js': null,
          'preload.js': null,
          'renderer.js': null,
          'index.html': null,
        },
      });
    });
  });

  describe('setupPaths()', () => {
    beforeEach(() => {
      setupGlobalWindow();
    });

    it('sets app paths', async () => {
      const obj = {
        appPath: '/fake/path',
      };
      (electron.ipcRenderer.invoke as jest.Mock).mockResolvedValue(obj);

      await setupPaths();

      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
        IpcEvents.GET_APP_PATHS,
      );
      expect((window as any).ElectronFiddle.appPaths).toBe(obj);
    });
  });
});
