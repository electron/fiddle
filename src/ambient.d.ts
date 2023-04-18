import * as MonacoType from 'monaco-editor';

import { EditorValues, FiddleEvent, SelectedLocalVersion } from './interfaces';
import { App } from './renderer/app';

declare global {
  interface Window {
    ElectronFiddle: {
      addEventListener(
        type: FiddleEvent,
        listener: (...args: any[]) => void,
        options?: { signal: AbortSignal },
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
