import { App } from './renderer/app';
import * as MonacoType from 'monaco-editor';

declare global {
  interface Window {
    ElectronFiddle: {
      app: App;
      appPaths: Record<string, string>;
      processPlatform: string;
      monaco: typeof MonacoType;
    };
  }
}
