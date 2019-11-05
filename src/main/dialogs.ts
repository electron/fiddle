import { dialog, IpcMainEvent } from 'electron';
import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';
import { getOrCreateMainWindow } from './windows';

/**
 * Listens to IPC events related to dialogs and message boxes
 *
 * @export
 */
export function setupDialogs() {
  ipcMainManager.on(IpcEvents.SHOW_WARNING_DIALOG, (_event, args) => {
    showWarningDialog(args);
  });

  ipcMainManager.on(IpcEvents.SHOW_CONFIRMATION_DIALOG, (_event, args) => {
    showConfirmationDialog(args);
  });

  ipcMainManager.on(IpcEvents.SHOW_LOCAL_VERSION_FOLDER_DIALOG, async (event) => {
    await showOpenDialog(event);
  });

}

/**
 * Shows a warning dialog
 *
 * @param {Electron.MessageBoxOptions} args
 */
function showWarningDialog(args: Electron.MessageBoxOptions) {
  dialog.showMessageBox(getOrCreateMainWindow(), {
    type: 'warning',
    ...args
  });
}

/**
 * Shows a confirmation dialog
 *
 * @param {Electron.MessageBoxOptions} args
 */
function showConfirmationDialog(args: Electron.MessageBoxOptions) {
  dialog.showMessageBox(getOrCreateMainWindow(), {
    type: 'warning',
    ...args
  });
}

async function showOpenDialog(event: IpcMainEvent) {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Open Folder',
    properties: ['openDirectory']
  });

  if (!filePaths || filePaths.length < 1) {
    return;
  }

  event.reply(IpcEvents.LOAD_LOCAL_VERSION_FOLDER, [filePaths[0]]);
}
