// Remember to update ambient.d.ts for extending window object
import { IpcEvents } from '../ipc-events';
import { ipcRendererManager } from '../renderer/ipc';

async function preload() {
  await setupFiddleGlobal();
}

export async function setupFiddleGlobal() {
  window.ElectronFiddle = {
    app: null as any, // will be set in main.tsx
    appPaths: await ipcRendererManager.invoke(IpcEvents.GET_APP_PATHS),
    monaco: null as any, // will be set in main.tsx
  };
}

preload();
