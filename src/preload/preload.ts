// Remember to update ambient.d.ts for extending window object
import { DefaultEditorId } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { ipcRendererManager } from '../renderer/ipc';

async function preload() {
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
      [DefaultEditorId.main]: null,
      [DefaultEditorId.renderer]: null,
      [DefaultEditorId.html]: null,
      [DefaultEditorId.preload]: null,
    },
    app: null,
  };
}

export async function setupPaths() {
  const appPaths = await ipcRendererManager.invoke(IpcEvents.GET_APP_PATHS);
  window.ElectronFiddle.appPaths = appPaths;
}

preload();
