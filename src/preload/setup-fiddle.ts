import { ipcRendererManager } from './ipc';
import { IpcEvents } from '../ipc-events';

export async function setupFiddleGlobal() {
  window.ElectronFiddle = {
    app: null as any, // will be set in main.tsx
    appPaths: await ipcRendererManager.invoke(IpcEvents.GET_APP_PATHS),
    monaco: null as any, // will be set in main.tsx
  };
}
