import { BrowserWindow, shell } from 'electron';
import { createContextMenu } from './context-menu';

// Keep a global reference of the window objects, if we don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
export let browserWindows: Array<BrowserWindow> = [];

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
      nodeIntegration: true
    }
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
  const browserWindow = new BrowserWindow(getMainWindowOptions());
  browserWindow.loadFile('./dist/static/index.html');

  browserWindow.webContents.once('dom-ready', () => {
    browserWindow.show();

    if (browserWindow) {
      createContextMenu(browserWindow);
    }
  });

  browserWindow.on('closed', () => {
    browserWindows = browserWindows
      .filter((bw) => browserWindow !== bw);
  });

  browserWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  browserWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
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
  return BrowserWindow.getFocusedWindow() || browserWindows[0] || createMainWindow();
}
