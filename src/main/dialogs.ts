import { dialog } from 'electron';
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
