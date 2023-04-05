import * as MonacoType from 'monaco-editor';

import { EditorValues, SelectedLocalVersion } from './interfaces';
import { App } from './renderer/app';

declare global {
  interface Window {
    ElectronFiddle: {
      app: App;
      appPaths: Record<string, string>;
      arch: string;
      getTemplateValues: (name: string) => Promise<EditorValues>;
      monaco: typeof MonacoType;
      platform: string;
      selectLocalVersion: () => Promise<SelectedLocalVersion | undefined>;
    };
  }
}
