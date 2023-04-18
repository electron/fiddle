// Remember to update ambient.d.ts for extending window object
import { ipcRenderer } from 'electron';

import { IpcEvents } from '../ipc-events';
import { isReleasedMajor } from '../renderer/versions';

async function preload() {
  await setupFiddleGlobal();
}

export async function setupFiddleGlobal() {
  window.ElectronFiddle = {
    app: null as any, // will be set in main.tsx
    appPaths: await ipcRenderer.invoke(IpcEvents.GET_APP_PATHS),
    arch: process.arch,
    getTemplate: (version: string) =>
      ipcRenderer.invoke(IpcEvents.GET_TEMPLATE, version),
    getTemplateValues: (name: string) => {
      return ipcRenderer.invoke(IpcEvents.GET_TEMPLATE_VALUES, name);
    },
    getTestTemplate: () => ipcRenderer.invoke(IpcEvents.GET_TEST_TEMPLATE),
    monaco: null as any, // will be set in main.tsx
    platform: process.platform,
    selectLocalVersion: () => {
      return ipcRenderer.invoke(IpcEvents.LOAD_LOCAL_VERSION_FOLDER);
    },
  };

  // TODO(dsanders11): Remove this when Electron versions move to main process
  ipcRenderer.on(IpcEvents.IS_RELEASED_MAJOR, (e, { major }) => {
    e.ports[0].postMessage(isReleasedMajor(major));
  });
}

preload();
