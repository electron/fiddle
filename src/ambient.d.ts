import * as MonacoType from 'monaco-editor';

import { EditorValues } from './interfaces';
import { App } from './renderer/app';

declare global {
  interface Window {
    ElectronFiddle: {
      app: App;
      appPaths: Record<string, string>;
      arch: string;
      getTemplate(version: string): Promise<EditorValues>;
      getTemplateValues: (name: string) => Promise<EditorValues>;
      getTestTemplate(): Promise<EditorValues>;
      monaco: typeof MonacoType;
      platform: string;
    };
  }
}
