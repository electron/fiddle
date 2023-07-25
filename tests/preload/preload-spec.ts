/**
 * @jest-environment node
 */
import * as electron from 'electron';
import { mocked } from 'jest-mock';

import { IpcEvents } from '../../src/ipc-events';
import { setupFiddleGlobal } from '../../src/preload/preload';

describe('preload', () => {
  // We instantiate this in `tests/setup.js` for the main and
  // renderer processes, but we don't need these mocks since
  // these things are being instantiated within the preload
  beforeEach(() => {
    delete (window as any).ElectronFiddle;
  });

  describe('setupGlobalWindow()', () => {
    it('sets up a window.ElectronFiddle object', async () => {
      await setupFiddleGlobal();

      expect(window.ElectronFiddle).toMatchObject({ app: null });
    });

    it('sets app paths', async () => {
      const obj = {
        appPath: '/fake/path',
      };
      mocked(electron.ipcRenderer.invoke).mockResolvedValue(obj);

      await setupFiddleGlobal();

      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
        IpcEvents.GET_APP_PATHS,
      );
      expect(window.ElectronFiddle.appPaths).toBe(obj);
    });
  });
});
