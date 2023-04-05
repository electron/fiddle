import * as electron from 'electron';

import { IpcEvents } from '../../src/ipc-events';

describe('ipcRenderer', () => {
  describe('emit()', () => {
    it('emits an Electron IPC event', () => {
      const mockListener = jest.fn();
      electron.ipcRenderer.on(IpcEvents.FIDDLE_RUN, mockListener);
      electron.ipcRenderer.emit(IpcEvents.FIDDLE_RUN);

      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('send()', () => {
    it('sends an event', () => {
      electron.ipcRenderer.send(IpcEvents.FIDDLE_RUN, 'hello');
      expect(electron.ipcRenderer.send).toHaveBeenCalledWith<any>(
        IpcEvents.FIDDLE_RUN,
        'hello',
      );
    });
  });

  describe('invoke()', () => {
    it('returns the value of ipcRenderer.invoke', async () => {
      (electron.ipcRenderer.invoke as jest.Mock).mockResolvedValue(1);
      const result = await electron.ipcRenderer.invoke(
        IpcEvents.FIDDLE_RUN,
        'hello',
      );

      expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
        IpcEvents.FIDDLE_RUN,
        'hello',
      );
      expect(result).toBe(1);
    });
  });
});
