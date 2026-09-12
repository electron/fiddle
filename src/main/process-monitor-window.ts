import { BrowserWindow } from 'electron';

// Global variables exposed by forge/webpack-plugin to reference
// the entry point of preload and index.html over http://
declare const PROCESS_MONITOR_WINDOW_WEBPACK_ENTRY: string;
declare const PROCESS_MONITOR_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let processMonitorWindow: BrowserWindow | null = null;

/**
 * Creates and shows the Process Monitor window.
 */
export function createProcessMonitorWindow(): BrowserWindow {
  if (processMonitorWindow) {
    // If it already exists, just show and focus it
    if (processMonitorWindow.isMinimized()) processMonitorWindow.restore();
    processMonitorWindow.show();
    processMonitorWindow.focus();
    return processMonitorWindow;
  }

  processMonitorWindow = new BrowserWindow({
    width: 450,
    height: 350,
    minWidth: 350,
    minHeight: 200,
    title: 'Process Monitor - Electron Fiddle',
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    backgroundColor: '#12121c',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PROCESS_MONITOR_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  processMonitorWindow.loadURL(PROCESS_MONITOR_WINDOW_WEBPACK_ENTRY);

  processMonitorWindow.on('closed', () => {
    processMonitorWindow = null;
  });

  // Prevent default window opening
  processMonitorWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  return processMonitorWindow;
}

/**
 * Gets the current Process Monitor window, if any.
 */
export function getProcessMonitorWindow(): BrowserWindow | null {
  return processMonitorWindow;
}

/**
 * Closes the Process Monitor window if it exists.
 */
export function closeProcessMonitorWindow() {
  if (processMonitorWindow) {
    processMonitorWindow.close();
  }
}
