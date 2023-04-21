import * as MonacoType from 'monaco-editor';

import { EditorValues, FiddleEvent, SelectedLocalVersion } from './interfaces';
import { App } from './renderer/app';

declare global {
  interface Window {
    ElectronFiddle: {
      addEventListener(
        type: FiddleEvent,
        listener: () => void,
        options?: { signal: AbortSignal },
      ): void;
      addEventListener(
        type: 'execute-monaco-command',
        listener: (commandId: string) => void,
        options?: { signal: AbortSignal },
      ): void;
      addEventListener(
        type: 'load-example',
        listener: (exampleInfo: { path: string; tag: string }) => void,
        options?: { signal: AbortSignal },
      ): void;
      addEventListener(
        type: 'load-gist',
        listener: (gistInfo: { id: string }) => void,
      ): void;
      addEventListener(
        type: 'open-fiddle',
        listener: (filePath: string) => void,
      ): void;
      addEventListener(
        type: 'open-template',
        listener: (name: string) => void,
      ): void;
      addEventListener(
        type: 'save-fiddle',
        listener: (filePath: string) => void,
      ): void;
      addEventListener(
        type: 'save-fiddle-forge',
        listener: (filePath: string) => void,
      ): void;
      addEventListener(
        type: 'toggle-monaco-option',
        listener: (path: string) => void,
      ): void;
      app: App;
      appPaths: Record<string, string>;
      arch: string;
      getTemplate(version: string): Promise<EditorValues>;
      getTemplateValues: (name: string) => Promise<EditorValues>;
      getTestTemplate(): Promise<EditorValues>;
      monaco: typeof MonacoType;
      platform: string;
      removeAllListeners(type: FiddleEvent): void;
      selectLocalVersion: () => Promise<SelectedLocalVersion | undefined>;
    };
  }
}
