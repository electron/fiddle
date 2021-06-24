import { app, BrowserWindow, shell } from 'electron';
import { IpcEvents } from '../ipc-events';
import { createContextMenu } from './context-menu';
import { ipcMainManager } from './ipc';
import * as path from 'path';

// Keep a global reference of the window objects, if we don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
export let browserWindows: Array<BrowserWindow | null> = [];

/**
 * Gets default options for the main window
 *
 * @returns {Electron.BrowserWindowConstructorOptions}
 */
export function getMainWindowOptions(): Electron.BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 900,
    minHeight: 600,
    minWidth: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    acceptFirstMouse: true,
    backgroundColor: '#1d2427',
    webPreferences: {
      webviewTag: false,
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, '..', 'preload', 'preload'),
    },
  };
}

/**
 * Creates a new main window.
 *
 * @export
 * @returns {Electron.BrowserWindow}
 */
export function createMainWindow(): Electron.BrowserWindow {
  console.log(`Creating main window`);
  let browserWindow: BrowserWindow | null;
  browserWindow = new BrowserWindow(getMainWindowOptions());
  browserWindow.loadFile('./dist/static/index.html');

  browserWindow.webContents.once('dom-ready', () => {
    if (browserWindow) {
      browserWindow.show();

      createContextMenu(browserWindow);
    }
  });

  browserWindow.on('focus', () => {
    if (browserWindow) {
      ipcMainManager.send(IpcEvents.SET_SHOW_ME_TEMPLATE);
    }
  });

  browserWindow.on('closed', () => {
    browserWindows = browserWindows.filter((bw) => browserWindow !== bw);

    browserWindow = null;
  });

  browserWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  browserWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  ipcMainManager.on(IpcEvents.SHOW_INACTIVE, () => {
    if (browserWindow) {
      browserWindow.showInactive();
    }
  });

  ipcMainManager.handle(IpcEvents.GET_APP_PATHS, () => {
    const paths = {};
    const pathsToQuery = [
      'home',
      'appData',
      'userData',
      'temp',
      'downloads',
      'desktop',
    ];
    for (const path of pathsToQuery) {
      paths[path] = app.getPath(path as any);
    }
    return paths;
  });

  browserWindows.push(browserWindow);

  return browserWindow;
}

/**
 * Gets or creates the main window, returning it in both cases.
 *
 * @returns {Electron.BrowserWindow}
 */
export function getOrCreateMainWindow(): Electron.BrowserWindow {
  return (
    BrowserWindow.getFocusedWindow() || browserWindows[0] || createMainWindow()
  );
}
