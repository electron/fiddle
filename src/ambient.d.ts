// Type-only-import
import { App as AppType } from './renderer/app';

declare global {
  interface Window {
    ElectronFiddle: {
      appPaths: Record<string, string>;
      app: AppType;
      contentChangeListeners: Array<any>;
    };
  }
}
