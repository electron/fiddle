import * as electron from 'electron';
import { IpcEvents } from '../../src/ipc-events';
import { ipcRendererManager } from '../../src/renderer/ipc';

describe('ipcRendererManager', () => {
  afterEach(() => {
    ipcRendererManager.removeAllListeners();
  });

  describe('emit()', () => {
    it('emits an Electron IPC event', () => {
      const mockListener = jest.fn();
      ipcRendererManager.on(IpcEvents.FIDDLE_RUN, mockListener);
      electron.ipcRenderer.emit(IpcEvents.FIDDLE_RUN);

      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('send()', () => {
    it('sends an event', () => {
      ipcRendererManager.send(IpcEvents.FIDDLE_RUN, 'hello');
      expect(electron.ipcRenderer.send).toHaveBeenCalledWith(IpcEvents.FIDDLE_RUN, 'hello');
    });
  });
});
