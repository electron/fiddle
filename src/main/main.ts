// eslint-disable-next-line import/order
import { initSentry } from './sentry';
initSentry();
import {
  BrowserWindow,
  IpcMainEvent,
  app,
  nativeTheme,
  systemPreferences,
} from 'electron';

import { setupAboutPanel } from './about-panel';
import { processCommandLine } from './command-line';
import { setupContent } from './content';
import { setupDevTools } from './devtools';
import { setupDialogs } from './dialogs';
import { setupTypes } from './electron-types';
import { setupFiddleCore } from './fiddle-core';
import { onFirstRunMaybe } from './first-run';
import { ipcMainManager } from './ipc';
import { setupNpm } from './npm';
import { listenForProtocolHandler, setupProtocolHandler } from './protocol';
import { shouldQuit } from './squirrel';
import { setupTemplates } from './templates';
import { setupThemes } from './themes';
import { setupUpdates } from './update';
import { isDevMode } from './utils/devmode';
import { getProjectName } from './utils/get-project-name';
import { getUsername } from './utils/get-username';
import { setupVersions } from './versions';
import { getOrCreateMainWindow, mainIsReady } from './windows';
import { IpcEvents } from '../ipc-events';

let argv: string[] = [];

/**
 * Handle the app's "ready" event. This is essentially
 * the method that takes care of booting the application.
 */
export async function onReady() {
  await onFirstRunMaybe();
  if (!isDevMode()) process.env.NODE_ENV = 'production';

  setupAboutPanel();

  const { setupMenu } = await import('./menu');
  const { setupFileListeners } = await import('./files');

  setupShowWindow();
  setupMenu();
  setupMenuHandler();
  setupProtocolHandler();
  setupFileListeners();
  setupUpdates();
  setupDialogs();
  setupDevTools();
  setupTitleBarClickMac();
  setupNativeTheme();
  setupTemplates();
  setupContent();
  setupThemes();
  setupIsDevMode();
  setupNpm();
  const knownVersions = await setupVersions();
  setupGetProjectName();
  setupGetUsername();
  setupTypes(knownVersions);
  await setupFiddleCore(knownVersions);

  // Do this after setting everything up to ensure that
  // any IPC listeners are set up before they're used
  mainIsReady();
  await getOrCreateMainWindow();

  processCommandLine(argv);
}

/**
 * Handle the "before-quit" event
 */
export function onBeforeQuit() {
  ipcMainManager.send(IpcEvents.BEFORE_QUIT);
  ipcMainManager.on(IpcEvents.CONFIRM_QUIT, app.quit);
}

export function setupShowWindow() {
  ipcMainManager.on(IpcEvents.SHOW_WINDOW, (event: IpcMainEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.show();
    }
  });
}

export function setupMenuHandler() {
  ipcMainManager.on(
    IpcEvents.BLOCK_ACCELERATORS,
    async (_, acceleratorsToBlock) => {
      (await import('./menu')).setupMenu({
        acceleratorsToBlock,
        activeTemplate: null,
      });
    },
  );

  ipcMainManager.on(
    IpcEvents.SET_SHOW_ME_TEMPLATE,
    async (_, activeTemplate) => {
      (await import('./menu')).setupMenu({
        acceleratorsToBlock: [],
        activeTemplate,
      });
    },
  );
}

/**
 * On macOS, set up the custom titlebar click handler.
 */
export function setupTitleBarClickMac() {
  if (process.platform !== 'darwin') {
    return;
  }

  ipcMainManager.on(IpcEvents.CLICK_TITLEBAR_MAC, (event: IpcMainEvent) => {
    const doubleClickAction = systemPreferences.getUserDefault(
      'AppleActionOnDoubleClick',
      'string',
    );
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (doubleClickAction === 'Minimize') {
        win.minimize();
      } else if (doubleClickAction === 'Maximize') {
        if (!win.isMaximized()) {
          win.maximize();
        } else {
          win.unmaximize();
        }
      }
    }
  });
}

function isNativeThemeSource(
  val: unknown,
): val is typeof nativeTheme.themeSource {
  return typeof val === 'string' && ['dark', 'light', 'system'].includes(val);
}

/**
 * Handle theme changes.
 */
export function setupNativeTheme() {
  ipcMainManager.on(IpcEvents.SET_NATIVE_THEME, async (_, source: string) => {
    if (isNativeThemeSource(source)) {
      nativeTheme.themeSource = source;
    }
  });
}

/**
 * Handle isDevMode for renderer.
 */
export function setupIsDevMode() {
  ipcMainManager.on(IpcEvents.IS_DEV_MODE, (event) => {
    event.returnValue = isDevMode();
  });
}

export function setupGetProjectName() {
  ipcMainManager.handle(IpcEvents.GET_PROJECT_NAME, (_, localPath?: string) =>
    getProjectName(localPath),
  );
}

export function setupGetUsername() {
  ipcMainManager.on(IpcEvents.GET_USERNAME, (event) => {
    event.returnValue = getUsername();
  });
}

/**
 * All windows have been closed, quit on anything but
 * macOS.
 */
export function onWindowsAllClosed() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

/**
 * The main method - and the first function to run
 * when Fiddle is launched.
 *
 * Exported for testing purposes.
 */
export function main(argv_in: string[]) {
  argv = argv_in;

  // Handle creating/removing shortcuts on Windows when
  // installing/uninstalling.
  if (shouldQuit()) {
    app.quit();
    return;
  }

  // Set the app's name
  app.name = 'Electron Fiddle';

  // Ensure that there's only ever one Fiddle running
  listenForProtocolHandler();

  // Launch
  app.whenReady().then(onReady);
  app.on('before-quit', onBeforeQuit);
  app.on('window-all-closed', onWindowsAllClosed);
  app.on('activate', () => {
    app.whenReady().then(getOrCreateMainWindow);
  });
}

// only call main() if this is the main module
if (typeof module !== 'undefined' && require.main === module) {
  main(process.argv);
}
