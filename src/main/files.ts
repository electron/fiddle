import * as path from 'node:path';

import { BrowserWindow, IpcMainEvent, app, dialog } from 'electron';
import * as fs from 'fs-extra';
import * as tmp from 'tmp';

import { ipcMainManager } from './ipc';
import { getFiles } from './utils/get-files';
import { readFiddle } from './utils/read-fiddle';
import { Files } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { isSupportedFile } from '../utils/editor-utils';

/**
 * Ensures that we're listening to file events
 */
export function setupFileListeners() {
  ipcMainManager.on(IpcEvents.PATH_EXISTS, (event, path: string) => {
    event.returnValue = fs.existsSync(path);
  });
  ipcMainManager.handle(
    IpcEvents.CLEANUP_DIRECTORY,
    (_: IpcMainEvent, dir: string) => cleanupDirectory(dir),
  );
  ipcMainManager.handle(
    IpcEvents.DELETE_USER_DATA,
    (_: IpcMainEvent, name: string) => deleteUserData(name),
  );
  ipcMainManager.handle(
    IpcEvents.SAVE_FILES_TO_TEMP,
    (_: IpcMainEvent, files: [string, string][]) =>
      saveFilesToTemp(new Map(files)),
  );
}

/**
 * Shows the "Open Fiddle" dialog and forwards
 * the path to the renderer
 */
export async function showOpenDialog(window: BrowserWindow) {
  const { filePaths } = await dialog.showOpenDialog(window, {
    title: 'Open Fiddle',
    properties: ['openDirectory'],
  });

  if (!filePaths || filePaths.length < 1) {
    return;
  }
  app.addRecentDocument(filePaths[0]);
  const files = await openFiddle(filePaths[0]);
  ipcMainManager.send(IpcEvents.FS_OPEN_FIDDLE, [filePaths[0], files]);
}

/**
 * Shows the "Save Fiddle" dialog and returns the path
 */
export async function showSaveDialog(
  window: BrowserWindow,
  as?: string,
): Promise<undefined | string> {
  // We want to save to a folder, so we'll use an open dialog here
  const { filePaths } = await dialog.showOpenDialog(window, {
    buttonLabel: 'Save here',
    properties: ['openDirectory', 'createDirectory'],
    title: `Save Fiddle${as ? ` as ${as}` : ''}`,
  });

  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return;
  }

  console.log(`Asked to save to ${filePaths[0]}`);

  // Let's confirm real quick if we want this
  if (await isOkToSaveAt(filePaths[0])) {
    return filePaths[0];
  }

  return;
}

/**
 * Confirm it's OK to save files in `folder`
 */
async function isOkToSaveAt(filePath: string): Promise<boolean> {
  return (
    !(await fs.pathExists(filePath)) ||
    (await fs.readdir(filePath)).filter(isSupportedFile).length === 0 ||
    (await confirmFileOverwrite(filePath))
  );
}

/**
 * Pops open a confirmation dialog, asking the user if they really
 * want to overwrite an existing file
 */
async function confirmFileOverwrite(filePath: string): Promise<boolean> {
  try {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Yes'],
      message: 'Overwrite files?',
      detail: `The file ${filePath} already exists. Do you want to overwrite it?`,
    });

    return result.response === 1;
  } catch (error) {
    // Let's not overwrite files. We'd rather crash.
    throw error;
  }
}

/**
 * Tries to open a fiddle.
 */
export async function openFiddle(
  filePath: string,
): Promise<Record<string, string>> {
  console.log(`openFiddle: Asked to open`, filePath);
  return readFiddle(filePath, true);
}

/**
 * Attempts to clean a given directory. Used to manually
 * clean temp directories.
 */
export async function cleanupDirectory(dir?: string): Promise<boolean> {
  if (dir) {
    if (fs.existsSync(dir)) {
      try {
        await fs.remove(dir);
        return true;
      } catch (error) {
        console.warn(`cleanupDirectory: Failed to clean directory`, error);
      }
    }
  }

  return false;
}

export async function deleteUserData(name: string) {
  const appData = path.join(app.getPath('appData'), name);
  console.log(`Cleanup: Deleting data dir ${appData}`);
  await cleanupDirectory(appData);
}

/**
 * Save the files to a temporary directory. Returns the
 * path to the temp directory.
 */
export async function saveFilesToTemp(files: Files): Promise<string> {
  const dir = tmp.dirSync({
    prefix: 'electron-fiddle',
  });

  tmp.setGracefulCleanup();

  for (const [name, content] of files) {
    try {
      await fs.outputFile(path.join(dir.name, name), content);
    } catch (error) {
      throw error;
    }
  }

  return dir.name;
}

/**
 * Safely attempts to save a file, doesn't crash the app if
 * it fails.
 */
async function saveFile(filePath: string, content: string): Promise<void> {
  try {
    return await fs.outputFile(filePath, content, { encoding: 'utf-8' });
  } catch (error) {
    console.log(`saveFile: Could not save ${filePath}`, error);
  }
}

/**
 * Safely attempts to remove a file, doesn't crash the app if
 * it fails.
 */
async function removeFile(filePath: string): Promise<void> {
  try {
    return await fs.remove(filePath);
  } catch (error) {
    console.log(`removeFile: Could not remove ${filePath}`, error);
  }
}

export async function saveFiles(
  window: BrowserWindow,
  filePath: string,
  files: Files,
) {
  console.log(`saveFiddleWithTransforms: Asked to save to ${filePath}`);

  for (const [fileName, content] of files) {
    const savePath = path.join(filePath, fileName);

    // If the file has content, save it to disk. If there's no
    // content in the file, remove a file that possibly exists.
    if (content) {
      await saveFile(savePath, content);
    } else {
      await removeFile(savePath);
    }
  }

  ipcMainManager.send(
    IpcEvents.SAVED_LOCAL_FIDDLE,
    [filePath],
    window.webContents,
  );
}

/**
 * Saves the current Fiddle to disk. If we never saved before,
 * we'll first open the "Save" dialog.
 */
export async function saveFiddle() {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    const { localPath, files } = await getFiles(window, ['dotfiles']);
    const pathToSave = localPath ?? (await showSaveDialog(window));
    if (pathToSave) {
      await saveFiles(window, pathToSave, files);
    }
  }
}

/**
 * Saves the current Fiddle to disk.
 */
export async function saveFiddleAs() {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    const { files } = await getFiles(window, ['dotfiles']);
    const pathToSave = await showSaveDialog(window);
    if (pathToSave) {
      await saveFiles(window, pathToSave, files);
    }
  }
}

/**
 * Saves the current Fiddle to disk as a Forge project.
 */
export async function saveFiddleAsForgeProject() {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    const { files } = await getFiles(window, ['dotfiles', 'forge']);
    const pathToSave = await showSaveDialog(window, 'Forge Project');
    if (pathToSave) {
      await saveFiles(window, pathToSave, files);
    }
  }
}
