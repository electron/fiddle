import { App } from './renderer/app';

declare global {
  interface Window {
    ElectronFiddle: {
      app: App;
      appPaths: Record<string, string>;
    };
  }
}
