import { dialog } from 'electron';
import { ipcMainManager } from './ipc';
import { IpcEvents } from '../ipc-events';
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
