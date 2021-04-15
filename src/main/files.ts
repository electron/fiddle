import * as fs from 'fs-extra';
import * as path from 'path';
import { dialog } from 'electron';

import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';
import { isSupportedFile } from '../utils/editor-utils';

/**
 * Ensures that we're listening to file events
 */
export function setupFileListeners() {
  ipcMainManager.on(IpcEvents.FS_SAVE_FIDDLE_DIALOG, () => {
    showSaveDialog();
  });
}

/**
 * Shows the "Open Fiddle" dialog and forwards
 * the path to the renderer
 */
export async function showOpenDialog() {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Open Fiddle',
    properties: ['openDirectory'],
  });

  if (!filePaths || filePaths.length < 1) {
    return;
  }

  ipcMainManager.send(IpcEvents.FS_OPEN_FIDDLE, [filePaths[0]]);
}

/**
 * Shows the "Save Fiddle" dialog and forwards
 * the path to the renderer
 */
export async function showSaveDialog(event?: IpcEvents, as?: string) {
  // We want to save to a folder, so we'll use an open dialog here
  const filePaths = dialog.showOpenDialogSync({
    buttonLabel: 'Save here',
    properties: ['openDirectory', 'createDirectory'],
    title: `Save Fiddle${as ? ` as ${as}` : ''}`,
  });

  if (!Array.isArray(filePaths)) {
    return;
  }

  const folder = filePaths.shift();
  if (!folder) {
    return;
  }

  console.log(`Asked to save to "${folder}"`);

  // Let's confirm real quick if we want this
  if (await isOkToSaveAt(folder)) {
    ipcMainManager.send(event || IpcEvents.FS_SAVE_FIDDLE, [folder]);
  }
}

/**
 * Confirm it's OK to save files in `folder`
 *
 * @param {string} folder
 * @returns {Promise<boolean>}
 */
async function isOkToSaveAt(folder: string): Promise<boolean> {
  return (
    !fs.existsSync(folder) ||
    fs.readdirSync(folder).filter(isSupportedFile).length === 0 ||
    (await confirmFileOverwrite(folder))
  );
}

/**
 * Pops open a confirmation dialog, asking the user if they really
 * want to overwrite an existing file
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function confirmFileOverwrite(folder: string): Promise<boolean> {
  try {
    const result = await dialog.showMessageBox({
      buttons: ['Cancel', 'Save'],
      detail: `The folder "${folder}" already has code in it.\n \nAre you sure you want to save here?`,
      message: `Save files to ${path.basename(folder)}?`,
      type: 'warning',
    });

    return !!result;
  } catch (error) {
    // Let's not overwrite files. We'd rather crash.
    throw error;
  }
}
