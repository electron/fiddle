import { WindowNames } from '../interfaces';
import { BrowserWindow } from 'electron';
import { ipcMainManager } from './ipc';
import { IpcEvents } from '../ipc-events';

// Keep a global reference of the window objects, if we don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
export const browserWindows: Record<WindowNames, Electron.BrowserWindow | null> = {
  main: null
};

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
    show: true,
    backgroundColor: '#1d2427'
  };
}

/**
 * Gets or creates the main window, returning it in both cases.
 *
 * @returns {Electron.BrowserWindow}
 */
export function getOrCreateMainWindow(): Electron.BrowserWindow {
  if (browserWindows.main) return browserWindows.main;

  browserWindows.main = new BrowserWindow(getMainWindowOptions());
  browserWindows.main.loadFile('./dist/index.html');

  browserWindows.main.on('closed', () => {
    browserWindows.main = null;
  });

  ipcMainManager.once(IpcEvents.MAIN_WINDOW_READY_TO_SHOW, () => {
    if (browserWindows.main) browserWindows.main.show();
  });

  return browserWindows.main;
}
