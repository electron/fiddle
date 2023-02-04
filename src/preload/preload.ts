import { contextBridge, ipcRenderer } from 'electron';

import { IpcEvents } from '../ipc-events';

export function setupFiddleGlobal() {
  // Remember to update ambient.d.ts for extending window object
  contextBridge.exposeInMainWorld('ElectronFiddle', {
    app: null, // will be set in main.tsx
    appPaths: ipcRenderer.sendSync(IpcEvents.GET_APP_PATHS),
    monaco: null, // will be set in main.tsx
  });
}

setupFiddleGlobal();
