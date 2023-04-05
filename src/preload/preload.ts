// Remember to update ambient.d.ts for extending window object
import { ipcRenderer } from 'electron';

import { IpcEvents } from '../ipc-events';

async function preload() {
  await setupFiddleGlobal();
}

export async function setupFiddleGlobal() {
  window.ElectronFiddle = {
    app: null as any, // will be set in main.tsx
    appPaths: await ipcRenderer.invoke(IpcEvents.GET_APP_PATHS),
    arch: process.arch,
    getTemplateValues: (name: string) => {
      return ipcRenderer.invoke(IpcEvents.GET_TEMPLATE_VALUES, name);
    },
    monaco: null as any, // will be set in main.tsx
    platform: process.platform,
    selectLocalVersion: () => {
      return ipcRenderer.invoke(IpcEvents.LOAD_LOCAL_VERSION_FOLDER);
    },
  };
}

preload();
