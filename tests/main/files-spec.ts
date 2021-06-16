/**
 * @jest-environment node
 */

import { IpcEvents } from '../../src/ipc-events';
import {
  setupFileListeners,
  showOpenDialog,
  showSaveDialog,
} from '../../src/main/files';
import { ipcMainManager } from '../../src/main/ipc';

import { app, dialog } from 'electron';
import * as fs from 'fs-extra';
import { getOrCreateMainWindow } from '../../src/main/windows';

jest.mock('../../src/main/windows');
jest.mock('fs-extra', () => ({
  existsSync: jest.fn(),
}));

const mockTarget = {
  webContents: {
    send: jest.fn(),
  },
};

describe('files', () => {
  beforeEach(() => {
    (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
      filePaths: ['my/fake/path'],
    });
    (getOrCreateMainWindow as jest.Mock).mockReturnValue(mockTarget);

    ipcMainManager.readyWebContents.add(mockTarget.webContents as any);
  });

  describe('setupFileListeners()', () => {
    it('sets up the listener', () => {
      setupFileListeners();

      expect(ipcMainManager.eventNames()).toEqual([
        IpcEvents.FS_SAVE_FIDDLE_DIALOG,
      ]);

      ipcMainManager.emit(IpcEvents.FS_SAVE_FIDDLE_DIALOG);
      expect(dialog.showOpenDialogSync).toHaveBeenCalled();
    });
  });

  describe('showOpenDialog', () => {
    it('tries to open an "open" dialog', async () => {
      await showOpenDialog();

      const call = (dialog.showOpenDialog as jest.Mock).mock.calls[0];

      expect(dialog.showOpenDialog).toHaveBeenCalled();
      expect(call[0]).toEqual({
        title: 'Open Fiddle',
        properties: ['openDirectory'],
      });
    });

    it('notifies the main window of the event', async () => {
      (getOrCreateMainWindow as jest.Mock).mockReturnValue(mockTarget);

      await showOpenDialog();

      expect(mockTarget.webContents.send).toHaveBeenCalledTimes(1);
    });

    it('adds the opened file path to recent files', async () => {
      (app.addRecentDocument as jest.Mock).mock.calls[0];
      await showOpenDialog();
      expect(app.addRecentDocument).toHaveBeenCalled();
    });
  });

  describe('showSaveDialog', () => {
    it('tries to open an "open" dialog to be used as a save dialog', async () => {
      await showSaveDialog();

      const call = (dialog.showOpenDialogSync as jest.Mock).mock.calls[0];

      expect(dialog.showOpenDialogSync).toHaveBeenCalled();
      expect(call[0]).toEqual({
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Save Fiddle',
      });
    });

    it('tries to open an "open" dialog to be used as a save as dialog', async () => {
      await showSaveDialog(IpcEvents.FS_SAVE_FIDDLE, 'hello');

      const call = (dialog.showOpenDialogSync as jest.Mock).mock.calls[0];

      expect(dialog.showOpenDialogSync).toHaveBeenCalled();
      expect(call[0]).toEqual({
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Save Fiddle as hello',
      });
    });

    it('handles not getting a path returned', async () => {
      (dialog.showOpenDialogSync as jest.Mock).mockReturnValueOnce([]);
      await showSaveDialog();
      expect(fs.existsSync).toHaveBeenCalledTimes(0);
    });

    it('ensures that the target is empty on save', async () => {
      (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['path']);
      (dialog.showMessageBox as jest.Mock).mockResolvedValue(true);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      ipcMainManager.readyWebContents.add(mockTarget.webContents as any);

      await showSaveDialog();

      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(mockTarget.webContents.send).toHaveBeenCalled();
    });

    it('does not overwrite files without consent', async () => {
      (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['path']);
      (dialog.showMessageBox as jest.Mock).mockResolvedValue(false);
      (getOrCreateMainWindow as jest.Mock).mockReturnValue(mockTarget);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await showSaveDialog();

      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(mockTarget.webContents.send).toHaveBeenCalledTimes(0);
    });

    it('does not overwrite files if an error happens', async () => {
      (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['path']);
      (dialog.showMessageBox as jest.Mock).mockImplementation(async () => {
        throw new Error('Nope');
      });
      (getOrCreateMainWindow as jest.Mock).mockReturnValue(mockTarget);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      let errored = false;

      try {
        await showSaveDialog();
      } catch (error) {
        errored = error;
      }

      expect(errored).toEqual(new Error('Nope'));
    });
  });
});
