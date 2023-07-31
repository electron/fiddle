import { ReleaseInfo } from '@electron/fiddle-core';
import * as MonacoType from 'monaco-editor';

import {
  BisectRequest,
  BlockableAccelerator,
  EditorValues,
  FiddleEvent,
  IPackageManager,
  InstallState,
  MessageOptions,
  OutputEntry,
  PMOperationOptions,
  RunResult,
  SelectedLocalVersion,
  TestRequest,
  Version,
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
      addModules(
        { dir, packageManager }: PMOperationOptions,
        ...names: Array<string>
      ): Promise<string>;
      app: App;
      appPaths: Record<string, string>;
      arch: string;
      blockAccelerators(acceleratorsToBlock: BlockableAccelerator[]): void;
      confirmQuit(): void;
      createThemeFile(
        newTheme: FiddleTheme,
        name?: string,
      ): Promise<LoadedFiddleTheme>;
      fetchVersions(): Promise<Version[]>;
      getAvailableThemes(): Promise<Array<LoadedFiddleTheme>>;
      getIsPackageManagerInstalled(
        packageManager: IPackageManager,
        ignoreCache?: boolean,
      ): Promise<boolean>;
      getProjectName(localPath?: string): Promise<string>;
      getTemplate(version: string): Promise<EditorValues>;
      getTemplateValues: (name: string) => Promise<EditorValues>;
      getTestTemplate(): Promise<EditorValues>;
      getLatestStable(): SemVer | undefined;
      getLocalVersionState(ver: Version): InstallState;
      getOldestSupportedMajor(): number | undefined;
      getReleaseInfo(version: string): Promise<ReleaseInfo | undefined>;
      getReleasedVersions(): Array<Version>;
      getUsername(): string;
      isDevMode: boolean;
      isReleasedMajor(major: number): Promise<boolean>;
      macTitlebarClicked(): void;
      monaco: typeof MonacoType;
      openThemeFolder(): Promise<void>;
      packageRun(
        { dir, packageManager }: PMOperationOptions,
        command: string,
      ): Promise<string>;
      pathExists(path: string): boolean;
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
