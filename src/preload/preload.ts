// Remember to update ambient.d.ts for extending window object
import { IpcEvents } from '../ipc-events';
import { ipcRendererManager } from '../renderer/ipc';

export async function preload() {
  setupGlobalWindow();
  await setupPaths();
}

/**
 * Editors exist outside of React's world. To make things *a lot*
 * easier, we keep them around in a global object. Don't judge us,
 * we're really only doing that for the editors.
 */
export function setupGlobalWindow() {
  window.ElectronFiddle = window.ElectronFiddle || {
    editors: {
      main: null,
      renderer: null,
      html: null,
      preload: null,
    },
    app: null,
  };
}

export async function setupPaths() {
  const appPaths = await ipcRendererManager.invoke(IpcEvents.SET_APPDATA_DIR);
  window.ElectronFiddle.appPaths = appPaths;
}

preload();
