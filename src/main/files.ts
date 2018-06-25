import { dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';

import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';
import { INDEX_HTML_NAME, RENDERER_JS_NAME, MAIN_JS_NAME, PACKAGE_NAME } from '../constants';

/**
 * Ensures that we're listening to file events
 */
export function setupFileListeners() {
  ipcMainManager.on(IpcEvents.FS_SAVE_FIDDLE_DIALOG, showSaveDialog);
}

/**
 * Shows the "Open Fiddle" dialog and forwards
 * the path to the renderer
 */
export function showOpenDialog() {
  dialog.showOpenDialog({
    title: 'Open Fiddle',
    properties: ['openDirectory']
  }, (filePaths) => {
    if (!filePaths || filePaths.length < 1) {
      return;
    }

    ipcMainManager.send(IpcEvents.FS_OPEN_FIDDLE, [ filePaths[0] ]);
  });
}

/**
 * Shows the "Save Fiddle" dialog and forwards
 * the path to the renderer
 */
export function showSaveDialog() {
  // We want to save to a folder, so we'll use an open dialog here
  dialog.showOpenDialog({
    title: 'Save Fiddle',
    buttonLabel: 'Save here',
    properties: ['openDirectory', 'createDirectory']
  }, async (filePaths) => {
    if (!filePaths || filePaths.length < 1) {
      return;
    }

    // Let's confirm real quick if we want this
    if (await ensureSaveTargetEmpty(filePaths[0])) {
      ipcMainManager.send(IpcEvents.FS_SAVE_FIDDLE, [ filePaths[0] ]);
    }
  });
}

/**
 * Ensures that a folder designated for saving is empty
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function ensureSaveTargetEmpty(filePath: string): Promise<boolean> {
  const targetPaths = [
    path.join(filePath, INDEX_HTML_NAME),
    path.join(filePath, RENDERER_JS_NAME),
    path.join(filePath, MAIN_JS_NAME),
    path.join(filePath, PACKAGE_NAME)
  ];

  let noFilesOrOverwriteGranted = true;

  for (const targetPath of targetPaths) {
    if (fs.existsSync(targetPath) && noFilesOrOverwriteGranted) {
      noFilesOrOverwriteGranted = await confirmFileOverwrite(targetPath);
    }
  }

  return noFilesOrOverwriteGranted;
}

/**
 * Pops open a confirmation dialog, asking the user if they really
 * want to overwrite an existing file
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function confirmFileOverwrite(filePath: string): Promise<boolean> {
  try {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: [ 'Cancel', 'Yes' ],
      message: 'Overwrite files?',
      detail: `The file ${filePath} already exists. Do you want to overwrite it?`,
    });

    return !!result;
  } catch (error) {
    // Let's not overwrite files. We'd rather crash.
    throw error;
  }
}
