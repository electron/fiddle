import { app } from 'electron';

import { getOrCreateMainWindow } from './windows';
import { setupMenu } from './menu';
import { setupProtocolHandler, listenForProtocolHandler } from './protocol';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

app.setName('Electron Fiddle');

listenForProtocolHandler();

app.on('ready', () => {
  getOrCreateMainWindow();
  setupMenu();
  setupProtocolHandler();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', getOrCreateMainWindow);
