// Remember to update ambient.d.ts for extending window object
import { IpcEvents } from '../ipc-events';
import { ipcRendererManager } from '../renderer/ipc';

export async function preload() {
  /**
   * Editors exist outside of React's world. To make things *a lot*
   * easier, we keep them around in a global object. Don't judge us,
   * we're really only doing that for the editors.
   */
  window.ElectronFiddle = window.ElectronFiddle || {
    editors: {
      main: null,
      renderer: null,
      html: null,
      preload: null,
    },
    app: null,
  };
  await setupPaths();
}

export async function setupPaths() {
  const appPaths = await ipcRenderer.invoke(IpcEvents.SET_APPDATA_DIR);
  window.ElectronFiddle.appPaths = appPaths;
}

preload();
