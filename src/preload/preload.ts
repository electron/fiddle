// Remember to update ambient.d.ts for extending window object
import { IpcEvents } from '../ipc-events';
import { ipcRendererManager } from '../renderer/ipc';

async function preload() {
  setupGlobalWindow();
  await setupPaths();
}

export function setupGlobalWindow() {
  window.ElectronFiddle = window.ElectronFiddle || {
    app: null,
  };
}

export async function setupPaths() {
  const appPaths = await ipcRendererManager.invoke(IpcEvents.GET_APP_PATHS);
  window.ElectronFiddle.appPaths = appPaths;
}

preload();
