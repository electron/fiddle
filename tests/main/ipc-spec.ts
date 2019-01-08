import * as electron from 'electron';
import { IpcEvents } from '../../src/ipc-events';
import { ipcMainManager } from '../../src/main/ipc';

import { getOrCreateMainWindow } from '../../src/main/windows';

jest.mock('../../src/main/windows');

describe('IpcMainManager', () => {
  afterEach(() => {
    ipcMainManager.removeAllListeners();
  });

  describe('emit()', () => {
    it('emits an Electron IPC event', () => {
      const mockListener = jest.fn();
      ipcMainManager.on(IpcEvents.SHOW_WARNING_DIALOG, mockListener);
      electron.ipcMain.emit(IpcEvents.SHOW_WARNING_DIALOG);

      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('send()', () => {
    it('sends an event', () => {
      const mockTarget = {
        webContents: {
          send: jest.fn()
        }
      };

      (getOrCreateMainWindow as jest.Mock<any>).mockReturnValue(mockTarget);

      ipcMainManager.send(IpcEvents.FIDDLE_RUN);

      expect(electron.ipcRenderer.send).toHaveBeenCalledWith(IpcEvents.FIDDLE_RUN, 'hello');
    });
  });
});
