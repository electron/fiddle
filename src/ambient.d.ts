import { App } from './renderer/app';
import * as MonacoType from 'monaco-editor';
import { IpcEvents } from './ipc-events';

declare global {
  interface Window {
    ElectronFiddle: {
      app: App;
      appPaths: Record<string, string>;
      monaco: typeof MonacoType;
    };

    IPC: {
      invoke: (channel: IpcEvents, ...args: Array<any>) => Promise<any>;
      off: (
        channel: IpcEvents,
        listener: (...args: Array<any>) => void,
      ) => void;
      on: (
        channel: IpcEvents,
        listener: (event: any, ...args: Array<any>) => void,
      ) => void;
      removeAllListeners: (channel: IpcEvents) => void;
      removeListener: (
        channel: IpcEvents,
        listener: (...args: Array<any>) => void,
      ) => void;
      send: (channel: IpcEvents, ...args: Array<any>) => void;
    };

    ElectronAPI: {
      setClipboardText: (
        text: string,
        type?: 'clipboard' | 'selection' | undefined,
      ) => void;
      getClipboardText: () => string;
      showItemInFolder: (path: string) => void;
      openExternalURL: (url: string) => Promise<void>;
    };

    NodeAPI: {
      readJSONSync: (file: string, options?: fs.ReadOptions | undefined) => any;
      outputJSON: (
        file: string,
        data: any,
        options?: fs.WriteOptions | undefined,
      ) => Promise<void>;
      joinPaths: (...paths: Array<string>) => string;
      readJSON: (file: string, options?: fs.ReadOptions | undefined) => any;
      ensureDir: (path: string) => Promise<void>;
      getpathSeparator: () => string;
      getPlatform: () => string;
    };
  }
}
