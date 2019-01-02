import { IpcEvents } from '../../src/ipc-events';
import {
  setupFileListeners,
  showOpenDialog,
  showSaveDialog
} from '../../src/main/files';
import { ipcMainManager } from '../../src/main/ipc';

import { dialog } from 'electron';
import * as fs from 'fs-extra';
import { getOrCreateMainWindow } from '../../src/main/windows';

jest.mock('../../src/main/windows');
jest.mock('fs-extra', () => ({
  existsSync: jest.fn()
}));

describe('files', () => {
  describe('setupFileListeners()', () => {
    setupFileListeners();

    expect(ipcMainManager.eventNames()).toEqual([
      IpcEvents.FS_SAVE_FIDDLE_DIALOG
    ]);
  });

  describe('showOpenDialog', () => {
    it('tries to open an "open" dialog', () => {
      showOpenDialog();

      const call = (dialog.showOpenDialog as jest.Mock<any>).mock.calls[0];

      expect(dialog.showOpenDialog).toHaveBeenCalled();
      expect(call[0]).toEqual({
        title: 'Open Fiddle',
        properties: ['openDirectory']
      });
    });

    it('notifies the main window of the event', async () => {
      showOpenDialog();

      const call = (dialog.showOpenDialog as jest.Mock<any>).mock.calls[0];
      const cb = call[1];
      const mockTarget = {
        webContents: {
          send: jest.fn()
        }
      };

      (getOrCreateMainWindow as jest.Mock<any>).mockReturnValue(mockTarget);

      await cb('/my/fake/path');
      expect(mockTarget.webContents.send).toHaveBeenCalledTimes(1);
      await cb('');
      expect(mockTarget.webContents.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('showSaveDialog', () => {
    it('tries to open an "open" dialog to be used as a save dialog', () => {
      showSaveDialog();

      const call = (dialog.showOpenDialog as jest.Mock<any>).mock.calls[0];

      expect(dialog.showOpenDialog).toHaveBeenCalled();
      expect(call[0]).toEqual({
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Save Fiddle'
      });
    });

    it('tries to open an "open" dialog to be used as a save as dialog', () => {
      showSaveDialog(IpcEvents.FS_SAVE_FIDDLE, 'hello');

      const call = (dialog.showOpenDialog as jest.Mock<any>).mock.calls[0];

      expect(dialog.showOpenDialog).toHaveBeenCalled();
      expect(call[0]).toEqual({
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Save Fiddle as hello'
      });
    });

    it('ensures that the target is empty on save', async () => {
      showSaveDialog();

      const call = (dialog.showOpenDialog as jest.Mock<any>).mock.calls[0];
      const cb = call[1];
      const mockTarget = {
        webContents: {
          send: jest.fn()
        }
      };

      (dialog.showMessageBox as jest.Mock<any>).mockImplementation(async () => true);
      (getOrCreateMainWindow as jest.Mock<any>).mockReturnValue(mockTarget);
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await cb('/my/fake/path');
      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(mockTarget.webContents.send).toHaveBeenCalled();
    });

    it('does not overwrite files without consent', async () => {
      showSaveDialog();

      const call = (dialog.showOpenDialog as jest.Mock<any>).mock.calls[0];
      const cb = call[1];
      const mockTarget = {
        webContents: {
          send: jest.fn()
        }
      };

      (dialog.showMessageBox as jest.Mock<any>).mockImplementation(async () => false);
      (getOrCreateMainWindow as jest.Mock<any>).mockReturnValue(mockTarget);
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await cb('/my/fake/path');
      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(mockTarget.webContents.send).toHaveBeenCalledTimes(0);
    });

    it('does not overwrite files if an error happens', async () => {
      showSaveDialog();

      const call = (dialog.showOpenDialog as jest.Mock<any>).mock.calls[0];
      const cb = call[1];
      const mockTarget = {
        webContents: {
          send: jest.fn()
        }
      };

      (dialog.showMessageBox as jest.Mock<any>).mockImplementation(async () => {
        throw new Error('Nope');
      });
      (getOrCreateMainWindow as jest.Mock<any>).mockReturnValue(mockTarget);
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      let errored = false;

      try {
        await cb('/fake/path');
      } catch (error) {
        errored = error;
      }

      expect(errored).toEqual(new Error('Nope'));
    });
  });
});
