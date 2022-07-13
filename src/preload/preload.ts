// Remember to update ambient.d.ts for extending window object
import { IpcEvents } from '../ipc-events';
import { ipcRendererManager } from './ipc';
import { contextBridge, clipboard, shell } from 'electron';
import { setupFiddleGlobal } from './setup-fiddle';
import * as fs from 'fs-extra';
import * as path from 'path';

// Exposes the objects defined over contextBridge API that can be accessed
// by `window.IPC`
contextBridge.exposeInMainWorld('IPC', {
  invoke: (channel: IpcEvents, ...args: Array<any>) =>
    ipcRendererManager.invoke(channel, ...args),

  off: (channel: IpcEvents, listener: (...args: Array<any>) => void) =>
    ipcRendererManager.off(channel, listener),

  on: (
    channel: IpcEvents,
    listener: (event: any, ...args: Array<any>) => void,
  ) => ipcRendererManager.on(channel, listener),

  removeAllListeners: (channel: IpcEvents) =>
    ipcRendererManager.removeAllListeners(channel),

  removeListener: (
    channel: IpcEvents,
    listener: (...args: Array<any>) => void,
  ) => ipcRendererManager.removeListener(channel, listener),

  send: (channel: IpcEvents, ...args: Array<any>) =>
    ipcRendererManager.send(channel, ...args),
});

// Involves API revolving around the core Electron
contextBridge.exposeInMainWorld('ElectronAPI', {
  setClipboardText: (
    text: string,
    type?: 'clipboard' | 'selection' | undefined,
  ) => {
    clipboard.writeText(text, type);
  },

  getClipboardText: (): string => {
    return clipboard.readText();
  },

  showItemInFolder: (path: string) => {
    shell.showItemInFolder(path);
  },

  openExternalURL: async (url: string): Promise<void> => {
    await shell.openExternal(url);
  },
});

// Exposes few main Node APIs used in components
contextBridge.exposeInMainWorld('NodeAPI', {
  readJSONSync: (file: string, options?: fs.ReadOptions | undefined): any => {
    return fs.readJSONSync(file, options);
  },

  outputJSON: async (
    file: string,
    data: any,
    options?: fs.WriteOptions | undefined,
  ): Promise<void> => {
    await fs.outputJSON(file, data, options);
  },

  joinPaths: (...paths: Array<string>): string => {
    return path.join(...paths);
  },

  readJSON: (file: string, options?: fs.ReadOptions | undefined): any => {
    return fs.readJSON(file, options);
  },

  ensureDir: async (path: string): Promise<void> => {
    await fs.ensureDir(path);
  },

  getPathSeparator: (): string => {
    return path.sep;
  },

  getPlatform: (): string => {
    return process.platform as string;
  },
});

// Exposes the objects that can be accessed by `window.ElectronFiddle`
async function preload() {
  await setupFiddleGlobal();
}

preload();
