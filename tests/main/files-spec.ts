/**
 * @jest-environment node
 */

import { app, dialog } from 'electron';
import * as fs from 'fs-extra';

import { MAIN_JS } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import {
  setupFileListeners,
  showOpenDialog,
  showSaveDialog,
} from '../../src/main/files';
import { ipcMainManager } from '../../src/main/ipc';
import { getOrCreateMainWindow } from '../../src/main/windows';

jest.mock('../../src/main/windows');
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
}));

const mockTarget = {
  webContents: ({
    send: jest.fn(),
    isDestroyed: () => false,
  } as unknown) as Electron.WebContents,
};

describe('files', () => {
  beforeEach(() => {
    (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
      filePaths: ['my/fake/path'],
    });
    (getOrCreateMainWindow as jest.Mock).mockReturnValue(mockTarget);

    ipcMainManager.readyWebContents.add(mockTarget.webContents);
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

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
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
      await showOpenDialog();
      expect(app.addRecentDocument).toHaveBeenCalled();
    });
  });

  describe('showSaveDialog', () => {
    it('tries to open an "open" dialog to be used as a save dialog', async () => {
      await showSaveDialog();

      expect(dialog.showOpenDialogSync).toHaveBeenCalledWith({
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Save Fiddle',
      });
    });

    it('tries to open an "open" dialog to be used as a save as dialog', async () => {
      await showSaveDialog(IpcEvents.FS_SAVE_FIDDLE, 'hello');

      expect(dialog.showOpenDialogSync).toHaveBeenCalledWith({
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Save Fiddle as hello',
      });
    });

    it('handles not getting a path returned', async () => {
      (dialog.showOpenDialogSync as jest.Mock).mockReturnValueOnce([]);
      await showSaveDialog();
      expect(fs.pathExists).toHaveBeenCalledTimes(0);
    });

    it('ensures that the target is empty on save', async () => {
      const consent = true;
      (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['path']);
      (dialog.showMessageBox as jest.Mock).mockResolvedValue(consent);
      (fs.pathExists as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockReturnValue([MAIN_JS]);
      ipcMainManager.readyWebContents.add(mockTarget.webContents);

      await showSaveDialog();

      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(mockTarget.webContents.send).toHaveBeenCalled();
    });

    it('does not overwrite files without consent', async () => {
      const consent = false;
      (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['path']);
      (dialog.showMessageBox as jest.Mock).mockResolvedValue(consent);
      (getOrCreateMainWindow as jest.Mock).mockReturnValue(mockTarget);
      (fs.pathExists as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockReturnValue([MAIN_JS]);

      await showSaveDialog();

      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(mockTarget.webContents.send).not.toHaveBeenCalled();
    });

    it('does not overwrite files if an error happens', async () => {
      const err = new Error('💩');
      (dialog.showOpenDialogSync as jest.Mock).mockReturnValue(['path']);
      (dialog.showMessageBox as jest.Mock).mockRejectedValue(err);
      (getOrCreateMainWindow as jest.Mock).mockReturnValue(mockTarget);
      (fs.pathExists as jest.Mock).mockReturnValue(true);
      (fs.readdir as jest.Mock).mockReturnValue([MAIN_JS]);

      let caughtError: unknown;
      try {
        await showSaveDialog();
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBe(err);
    });
  });
});
