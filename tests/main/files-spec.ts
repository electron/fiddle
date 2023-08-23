/**
 * @jest-environment node
 */

import { app, dialog } from 'electron';
import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';

import { MAIN_JS } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import {
  cleanupDirectory,
  setupFileListeners,
  showOpenDialog,
  showSaveDialog,
} from '../../src/main/files';
import { ipcMainManager } from '../../src/main/ipc';
import { getOrCreateMainWindow } from '../../src/main/windows';

jest.mock('../../src/main/windows');
jest.mock('fs-extra');

const mockTarget = {
  webContents: {
    send: jest.fn(),
    isDestroyed: () => false,
  } as unknown as Electron.WebContents,
};

describe('files', () => {
  beforeEach(() => {
    mocked(dialog.showOpenDialog).mockResolvedValue({
      filePaths: ['my/fake/path'],
      canceled: false,
    });
    mocked(getOrCreateMainWindow).mockResolvedValue(
      mockTarget as Partial<Electron.BrowserWindow> as Electron.BrowserWindow,
    );

    ipcMainManager.readyWebContents.add(mockTarget.webContents);
  });

  describe('setupFileListeners()', () => {
    it('sets up the listener', () => {
      setupFileListeners();

      expect(ipcMainManager.eventNames()).toEqual([
        IpcEvents.PATH_EXISTS,
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
      mocked(getOrCreateMainWindow).mockResolvedValue(
        mockTarget as Partial<Electron.BrowserWindow> as Electron.BrowserWindow,
      );

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
      mocked(dialog.showOpenDialogSync).mockReturnValueOnce([]);
      await showSaveDialog();
      expect(fs.pathExists).toHaveBeenCalledTimes(0);
    });

    it('ensures that the target is empty on save', async () => {
      const consent = true;
      mocked(dialog.showOpenDialogSync).mockReturnValue(['path']);
      mocked(dialog.showMessageBox).mockResolvedValue({
        response: consent ? 1 : 0,
        checkboxChecked: false,
      });
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue([MAIN_JS]);
      ipcMainManager.readyWebContents.add(mockTarget.webContents);

      await showSaveDialog();

      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(mockTarget.webContents.send).toHaveBeenCalled();
    });

    it('does not overwrite files without consent', async () => {
      const consent = false;
      mocked(dialog.showOpenDialogSync).mockReturnValue(['path']);
      mocked(dialog.showMessageBox).mockResolvedValue({
        response: consent ? 1 : 0,
        checkboxChecked: false,
      });
      mocked(getOrCreateMainWindow).mockResolvedValue(
        mockTarget as Partial<Electron.BrowserWindow> as Electron.BrowserWindow,
      );
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue([MAIN_JS]);

      await showSaveDialog();

      expect(dialog.showMessageBox).toHaveBeenCalled();
      expect(mockTarget.webContents.send).not.toHaveBeenCalled();
    });

    it('does not overwrite files if an error happens', async () => {
      const err = new Error('💩');
      mocked(dialog.showOpenDialogSync).mockReturnValue(['path']);
      mocked(dialog.showMessageBox).mockRejectedValue(err);
      mocked(getOrCreateMainWindow).mockResolvedValue(
        mockTarget as Partial<Electron.BrowserWindow> as Electron.BrowserWindow,
      );
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue([MAIN_JS]);

      let caughtError: unknown;
      try {
        await showSaveDialog();
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBe(err);
    });
  });

  describe('cleanupDirectory()', () => {
    it('attempts to remove a directory if it exists', async () => {
      mocked(fs.existsSync).mockReturnValueOnce(true);

      const result = await cleanupDirectory('/fake/dir');

      expect(fs.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('does not attempt to remove a directory if it does not exists', async () => {
      mocked(fs.existsSync).mockReturnValueOnce(false);

      const result = await cleanupDirectory('/fake/dir');

      expect(fs.remove).toHaveBeenCalledTimes(0);
      expect(result).toBe(false);
    });

    it('handles an error', async () => {
      mocked(fs.existsSync).mockReturnValueOnce(true);
      (fs.remove as jest.Mock).mockRejectedValueOnce('bwapbwap');

      const result = await cleanupDirectory('/fake/dir');

      expect(result).toBe(false);
    });
  });
});
