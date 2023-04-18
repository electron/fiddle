import * as path from 'path';

import { Installer } from '@electron/fiddle-core';
import { dialog } from 'electron';
import * as fs from 'fs-extra';

import { SelectedLocalVersion } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';
import { getOrCreateMainWindow } from './windows';

/**
 * Build a default name for a local Electron version
 * from its dirname.
 *
 * @param {string} folderPath
 * @return {string} human-readable local build name
 */
function makeLocalName(folderPath: string): string {
  // take a dirname like '/home/username/electron/gn/main/src/out/testing'
  // and return something like 'gn/main - testing'
  const tokens = folderPath.split(path.sep);
  const buildType = tokens.pop(); // e.g. 'testing' or 'release'
  const leader = tokens
    // remove 'src/out/' -- they are in every local build, so make poor names
    .slice(0, -2)
    .join(path.sep)
    // extract about enough for the end result to be about 20 chars
    .slice(-20 + buildType!.length)
    // remove any fragment in case the prev slice cut in the middle of a name
    .split(path.sep)
    .slice(1)
    .join(path.sep);
  return `${leader} - ${buildType}`;
}

/**
 * Verifies if the local electron path is valid
 *
 * @param {string} folderPath
 * @return {boolean}
 */
function isValidElectronPath(folderPath: string): boolean {
  const execPath = Installer.getExecPath(folderPath);
  return fs.existsSync(execPath);
}

/**
 * Listens to IPC events related to dialogs and message boxes
 *
 * @export
 */
export function setupDialogs() {
  ipcMainManager.on(IpcEvents.SHOW_WARNING_DIALOG, (_event, args) => {
    showWarningDialog(args);
  });

  ipcMainManager.handle(
    IpcEvents.LOAD_LOCAL_VERSION_FOLDER,
    async (): Promise<SelectedLocalVersion | undefined> => {
      const folderPath = await showOpenDialog();

      if (folderPath) {
        const isValidElectron = isValidElectronPath(folderPath);
        const localName = isValidElectron
          ? makeLocalName(folderPath)
          : undefined;

        return { folderPath, isValidElectron, localName };
      }

      return undefined;
    },
  );
}

/**
 * Shows a warning dialog
 *
 * @param {Electron.MessageBoxOptions} args
 */
function showWarningDialog(args: Electron.MessageBoxOptions) {
  dialog.showMessageBox(getOrCreateMainWindow(), {
    type: 'warning',
    ...args,
  });
}

async function showOpenDialog() {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Open Folder',
    properties: ['openDirectory'],
  });

  if (!filePaths || filePaths.length < 1) {
    return;
  }

  return filePaths[0];
}
