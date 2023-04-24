import * as MonacoType from 'monaco-editor';

import {
  BisectRequest,
  BlockableAccelerator,
  EditorValues,
  FiddleEvent,
  MessageOptions,
  OutputEntry,
  RunResult,
  SelectedLocalVersion,
  TestRequest,
} from './interfaces';
import { App } from './renderer/app';
import { FiddleTheme, LoadedFiddleTheme } from './themes-defaults';

declare global {
  interface Window {
    ElectronFiddle: {
      addEventListener(
        type: FiddleEvent,
        listener: () => void,
        options?: { signal: AbortSignal },
      ): void;
      addEventListener(
        type: 'bisect-task',
        listener: (request: BisectRequest) => void,
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
        type: 'test-task',
        listener: (request: TestRequest) => void,
        options?: { signal: AbortSignal },
      ): void;
      addEventListener(
        type: 'toggle-monaco-option',
        listener: (path: string) => void,
      ): void;
      app: App;
      appPaths: Record<string, string>;
      arch: string;
      blockAccelerators(acceleratorsToBlock: BlockableAccelerator[]): void;
      confirmQuit(): void;
      createThemeFile(
        newTheme: FiddleTheme,
        name?: string,
      ): Promise<LoadedFiddleTheme>;
      getAvailableThemes(): Promise<Array<LoadedFiddleTheme>>;
      getTemplate(version: string): Promise<EditorValues>;
      getTemplateValues: (name: string) => Promise<EditorValues>;
      getTestTemplate(): Promise<EditorValues>;
      macTitlebarClicked(): void;
      monaco: typeof MonacoType;
      openThemeFolder(): Promise<void>;
      platform: string;
      pushOutputEntry(entry: OutputEntry): void;
      readThemeFile(name?: string): Promise<LoadedFiddleTheme | null>;
      reloadWindows(): void;
      removeAllListeners(type: FiddleEvent): void;
      selectLocalVersion: () => Promise<SelectedLocalVersion | undefined>;
      sendReady(): void;
      setNativeTheme(theme: 'dark' | 'light' | 'system'): void;
      setShowMeTemplate(template?: string): void;
      showSaveDialog(): void;
      showWarningDialog(messageOptions: MessageOptions): void;
      showWindow(): void;
      taskDone(result: RunResult): void;
      themePath: string;
    };
  }
}
