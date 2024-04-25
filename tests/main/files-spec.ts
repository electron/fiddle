/**
 * @jest-environment node
 */

import { BrowserWindow, app, dialog } from 'electron';
import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';
import * as tmp from 'tmp';

import { MAIN_JS } from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import {
  cleanupDirectory,
  saveFiddle,
  saveFiddleAs,
  saveFiddleAsForgeProject,
  saveFiles,
  saveFilesToTemp,
  setupFileListeners,
  showOpenDialog,
  showSaveDialog,
} from '../../src/main/files';
import { ipcMainManager } from '../../src/main/ipc';
import { getFiles } from '../../src/main/utils/get-files';
import { getOrCreateMainWindow } from '../../src/main/windows';
import { BrowserWindowMock } from '../mocks/browser-window';
import { createEditorValues } from '../mocks/editor-values';

jest.mock('../../src/main/windows');
jest.mock('../../src/main/utils/get-files');
jest.mock('fs-extra');
jest.mock('tmp');

const mockWindow = new BrowserWindowMock() as unknown as Electron.BrowserWindow;

describe('files', () => {
  const editorValues = createEditorValues();

  beforeEach(() => {
    mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockWindow);
    mocked(getFiles).mockResolvedValue({
      localPath: 'my/fake/path',
      files: new Map(Object.entries(editorValues)),
    });
    mocked(dialog.showOpenDialog).mockResolvedValue({
      filePaths: ['my/fake/path'],
      canceled: false,
    });
    mocked(getOrCreateMainWindow).mockResolvedValue(mockWindow);

    ipcMainManager.readyWebContents.add(mockWindow.webContents);
  });

  describe('setupFileListeners()', () => {
    it('sets up the listener', () => {
      const spy = jest.spyOn(ipcMainManager, 'handle');
      setupFileListeners();

      expect(ipcMainManager.eventNames()).toEqual([IpcEvents.PATH_EXISTS]);
      expect(spy).toHaveBeenCalledWith(
        IpcEvents.CLEANUP_DIRECTORY,
        expect.anything(),
      );
      expect(spy).toHaveBeenCalledWith(
        IpcEvents.DELETE_USER_DATA,
        expect.anything(),
      );
      expect(spy).toHaveBeenCalledWith(
        IpcEvents.SAVE_FILES_TO_TEMP,
        expect.anything(),
      );
      spy.mockReset();
    });
  });

  describe('showOpenDialog', () => {
    it('tries to open an "open" dialog', async () => {
      await showOpenDialog(mockWindow);

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(mockWindow, {
        title: 'Open Fiddle',
        properties: ['openDirectory'],
      });
    });

    it('notifies the main window of the event', async () => {
      mocked(getOrCreateMainWindow).mockResolvedValue(mockWindow);

      await showOpenDialog(mockWindow);

      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1);
    });

    it('adds the opened file path to recent files', async () => {
      await showOpenDialog(mockWindow);
      expect(app.addRecentDocument).toHaveBeenCalled();
    });
  });

  describe('showSaveDialog', () => {
    it('tries to open an "open" dialog to be used as a save dialog', async () => {
      await showSaveDialog(mockWindow);

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(mockWindow, {
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Save Fiddle',
      });
    });

    it('tries to open an "open" dialog to be used as a save as dialog', async () => {
      await showSaveDialog(mockWindow, 'hello');

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(mockWindow, {
        buttonLabel: 'Save here',
        properties: ['openDirectory', 'createDirectory'],
        title: 'Save Fiddle as hello',
      });
    });

    it('handles not getting a path returned', async () => {
      mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: [],
      });
      await showSaveDialog(mockWindow);
      expect(fs.pathExists).toHaveBeenCalledTimes(0);
    });

    it('ensures that the target is empty on save', async () => {
      const consent = true;
      mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: false,
        filePaths: ['path'],
      });
      mocked(dialog.showMessageBox).mockResolvedValue({
        response: consent ? 1 : 0,
        checkboxChecked: false,
      });
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue([MAIN_JS]);

      await showSaveDialog(mockWindow);

      expect(dialog.showMessageBox).toHaveBeenCalled();
    });

    it('does not overwrite files without consent', async () => {
      const consent = false;
      mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: ['path'],
      });
      mocked(dialog.showMessageBox).mockResolvedValue({
        response: consent ? 1 : 0,
        checkboxChecked: false,
      });
      mocked(getOrCreateMainWindow).mockResolvedValue(mockWindow);
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue([MAIN_JS]);

      await showSaveDialog(mockWindow);

      expect(dialog.showMessageBox).toHaveBeenCalled();
    });

    it('does not overwrite files if an error happens', async () => {
      const err = new Error('💩');
      mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: ['path'],
      });
      mocked(dialog.showMessageBox).mockRejectedValue(err);
      mocked(getOrCreateMainWindow).mockResolvedValue(mockWindow);
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readdir as jest.Mock).mockResolvedValue([MAIN_JS]);

      let caughtError: unknown;
      try {
        await showSaveDialog(mockWindow);
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

  describe('saveFiles()', () => {
    it('saves all non-empty files in Fiddle', async () => {
      const values = { ...editorValues };
      await saveFiles(
        mockWindow,
        '/fake/path',
        new Map(Object.entries(values)),
      );

      expect(fs.outputFile).toHaveBeenCalledTimes(Object.keys(values).length);
    });

    it('saves a fiddle with supported files', async () => {
      const file = 'file.js';
      const content = '// hi';
      const values = { ...editorValues, [file]: content };

      await saveFiles(
        mockWindow,
        '/fake/path',
        new Map(Object.entries(values)),
      );
      expect(fs.outputFile).toHaveBeenCalledTimes(Object.keys(values).length);
    });

    it('removes a file that is newly empty', async () => {
      const values = { ...editorValues, 'index.html': '' };
      await saveFiles(
        mockWindow,
        '/fake/path',
        new Map(Object.entries(values)),
      );

      expect(fs.remove).toHaveBeenCalledTimes(1);
    });

    it('handles an error (output)', async () => {
      const spy = jest.spyOn(ipcMainManager, 'send');
      mocked(fs.outputFile).mockImplementation(() => {
        throw new Error('bwap');
      });

      await saveFiles(
        mockWindow,
        'my/fake/path',
        new Map(Object.entries(editorValues)),
      );

      const n = Object.keys(editorValues).length;
      expect(fs.outputFile).toHaveBeenCalledTimes(n);
      expect(spy).toHaveBeenCalledWith(
        IpcEvents.SAVED_LOCAL_FIDDLE,
        ['my/fake/path'],
        mockWindow.webContents,
      );
      spy.mockClear();
    });

    it('handles an error (remove)', async () => {
      const values = { ...editorValues, 'index.html': '' };
      mocked(fs.remove).mockImplementation(() => {
        throw new Error('bwap');
      });
      await saveFiles(
        mockWindow,
        '/fake/path',
        new Map(Object.entries(values)),
      );

      expect(fs.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveFiddle()', () => {
    it('asks for a path if none can be found', async () => {
      mocked(getFiles).mockResolvedValue({ files: new Map() });
      await saveFiddle();

      expect(dialog.showOpenDialog).toHaveBeenCalled();
    });
  });

  describe('saveFiddleAs()', () => {
    it('always asks for a file path', async () => {
      mocked(getFiles).mockResolvedValue({
        localPath: '/fake/path',
        files: new Map(),
      });
      await saveFiddleAs();

      expect(dialog.showOpenDialog).toHaveBeenCalled();
    });
  });

  describe('saveFiddleAsForgeProject()', () => {
    it('always asks for a file path', async () => {
      mocked(getFiles).mockResolvedValue({
        localPath: '/fake/path',
        files: new Map(),
      });
      await saveFiddleAsForgeProject();

      expect(dialog.showOpenDialog).toHaveBeenCalled();
    });

    it('uses the forge transform', async () => {
      mocked(getFiles).mockResolvedValue({
        localPath: '/fake/path',
        files: new Map(),
      });
      await saveFiddleAsForgeProject();
      expect(getFiles).toHaveBeenCalledWith(
        mockWindow,
        expect.arrayContaining(['forge']),
      );
    });
  });

  it('saveFilesToTemp()', async () => {
    const tmpPath = '/tmp/save-to-temp/';
    jest.spyOn(tmp, 'dirSync').mockReturnValue({
      name: tmpPath,
    } as tmp.DirResult);

    await expect(
      saveFilesToTemp(
        new Map([
          ['foo.js', ''],
          ['bar.js', ''],
          ['package.json', ''],
        ]),
      ),
    ).resolves.toEqual(tmpPath);
    expect(fs.outputFile).toHaveBeenCalledTimes(3);
    expect(tmp.setGracefulCleanup).toHaveBeenCalled();
  });
});
