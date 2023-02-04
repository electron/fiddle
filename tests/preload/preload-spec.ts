/**
 * @jest-environment node
 */
import * as electron from 'electron';

import { IpcEvents } from '../../src/ipc-events';
import { setupFiddleGlobal } from '../../src/preload/preload';

describe('preload', () => {
  describe('setupFiddleGlobal()', () => {
    it('exposes an ElectronFiddle object via the contextBridge', async () => {
      (electron.contextBridge.exposeInMainWorld as jest.Mock).mockReturnValue(
        undefined,
      );
      await setupFiddleGlobal();

      expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'ElectronFiddle',
        expect.objectContaining({ app: null }),
      );
    });

    it('sets app paths', async () => {
      const obj = {
        appPath: '/fake/path',
      };
      (electron.ipcRenderer.sendSync as jest.Mock).mockReturnValue(obj);
      (electron.contextBridge.exposeInMainWorld as jest.Mock).mockReturnValue(
        undefined,
      );

      await setupFiddleGlobal();

      expect(electron.ipcRenderer.sendSync).toHaveBeenCalledWith(
        IpcEvents.GET_APP_PATHS,
      );
      expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'ElectronFiddle',
        expect.objectContaining({ appPaths: obj }),
      );
    });
  });
});
