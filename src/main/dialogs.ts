import * as path from 'node:path';

import { Installer } from '@electron/fiddle-core';
import { BrowserWindow, dialog } from 'electron';
import * as fs from 'fs-extra';

import { ipcMainManager } from './ipc';
import { SelectedLocalVersion } from '../interfaces';
import { IpcEvents } from '../ipc-events';

/**
 * Build a default name for a local Electron version
 * from its dirname.
 * @returns human-readable local build name
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
 */
function isValidElectronPath(folderPath: string): boolean {
  const execPath = Installer.getExecPath(folderPath);
  return fs.existsSync(execPath);
}

/**
 * Listens to IPC events related to dialogs and message boxes
 */
export function setupDialogs() {
  ipcMainManager.on(IpcEvents.SHOW_WARNING_DIALOG, (event, args) => {
    showWarningDialog(BrowserWindow.fromWebContents(event.sender)!, args);
  });

  ipcMainManager.handle(
    IpcEvents.LOAD_LOCAL_VERSION_FOLDER,
    async (event): Promise<SelectedLocalVersion | undefined> => {
      const folderPath = await showOpenDialog(
        BrowserWindow.fromWebContents(event.sender)!,
      );

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
 */
function showWarningDialog(
  window: BrowserWindow,
  args: Electron.MessageBoxOptions,
) {
  dialog.showMessageBox(window, {
    type: 'warning',
    ...args,
  });
}

async function showOpenDialog(window: BrowserWindow) {
  const { filePaths } = await dialog.showOpenDialog(window, {
    title: 'Open Folder',
    properties: ['openDirectory'],
  });

  if (!filePaths || filePaths.length < 1) {
    return;
  }

  return filePaths[0];
}
