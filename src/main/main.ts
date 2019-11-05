import { app } from 'electron';

import { isDevMode } from '../utils/devmode';
import { setupAboutPanel } from '../utils/set-about-panel';
import { setupDevTools } from './devtools';
import { setupDialogs } from './dialogs';
import { onFirstRunMaybe } from './first-run';
import { listenForProtocolHandler, setupProtocolHandler } from './protocol';
import { shouldQuit } from './squirrel';
import { setupUpdates } from './update';
import { getOrCreateMainWindow } from './windows';

/**
 * Handle the app's "ready" event. This is essentially
 * the method that takes care of booting the application.
 */
export async function onReady() {
  await onFirstRunMaybe();
  if (!isDevMode()) process.env.NODE_ENV = 'production';

  getOrCreateMainWindow();
  setupAboutPanel();

  const { setupMenu } = await import('./menu');
  const { setupFileListeners } = await import('./files');

  setupMenu();
  setupProtocolHandler();
  setupFileListeners();
  setupUpdates();
  setupDialogs();
  setupDevTools();
}

/**
 * Handle the "before-quit" event
 *
 * @export
 */
export function onBeforeQuit() {
  (global as any).isQuitting = true;
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
export function main() {
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
  app.on('ready', onReady);
  app.on('before-quit', onBeforeQuit);
  app.on('window-all-closed', onWindowsAllClosed);
  app.on('activate', getOrCreateMainWindow);
}

main();
