import { app, dialog } from 'electron';
import { isFirstRun } from '../utils/check-first-run';
import { isDevMode } from '../utils/devmode';
import { setupDialogs } from './dialogs';
import { listenForProtocolHandler, setupProtocolHandler } from './protocol';
import { setupUpdates } from './update';
import { getOrCreateMainWindow } from './windows';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

app.setName('Electron Fiddle');

listenForProtocolHandler();

app.on('ready', async () => {
  if (isFirstRun()) promptMoveToApplicationsFolder();
  if (!isDevMode()) process.env.NODE_ENV = 'production';

  getOrCreateMainWindow();

  const { setupMenu } = await import('./menu');
  const { setupFileListeners } = await import('./files');

  setupMenu();
  setupProtocolHandler();
  setupFileListeners();
  setupUpdates();
  setupDialogs();
});

function promptMoveToApplicationsFolder() {
  if (!isDevMode() && !app.isInApplicationsFolder()) return;

  dialog.showMessageBox({
    type: 'question',
    buttons: ['Move to Applications Folder', 'Do Not Move'],
    defaultId: 0,
    message: 'Move to Applications Folder?',
  }, (response) => {
    if (response !== 0) return;
    app.moveToApplicationsFolder();
  });
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', getOrCreateMainWindow);
