import * as MonacoType from 'monaco-editor';

import {
  BisectRequest,
  BlockableAccelerator,
  DownloadVersionParams,
  EditorValues,
  FiddleEvent,
  FileTransformOperation,
  Files,
  IPackageManager,
  InstallState,
  InstallStateEvent,
  MessageOptions,
  NodeTypes,
  OutputEntry,
  PMOperationOptions,
  PackageJsonOptions,
  ProgressObject,
  ReleaseInfo,
  RunResult,
  RunnableVersion,
  SelectedLocalVersion,
  SemVer,
  StartFiddleParams,
  TestRequest,
  Version,
} from './interfaces';
import { App } from './renderer/app';
import { FiddleTheme, LoadedFiddleTheme } from './themes-defaults';

declare global {
  interface Window {
    app: App;
    monaco: typeof MonacoType;
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
        type: 'fiddle-runner-output',
        listener: (output: string) => void,
      ): void;
      addEventListener(
        type: 'fiddle-stopped',
        listener: (code: number | null, signal: string | null) => void,
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
        listener: (filePath: string, files: Record<string, string>) => void,
      ): void;
      addEventListener(
        type: 'open-template',
        listener: (name: string, editorValues: EditorValues) => void,
      ): void;
      addEventListener(
        type: 'saved-local-fiddle',
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
      addEventListener(
        type: 'version-download-progress',
        listener: (version: string, progress: ProgressObject) => void,
      ): void;
      addEventListener(
        type: 'version-state-changed',
        listener: (event: InstallStateEvent) => void,
      ): void;
      addEventListener(
        type: 'electron-types-changed',
        listener: (types: string, version: string) => void,
      ): void;
      addModules(
        { dir, packageManager }: PMOperationOptions,
        ...names: Array<string>
      ): Promise<string>;
      arch: string;
      blockAccelerators(acceleratorsToBlock: BlockableAccelerator[]): void;
      cleanupDirectory(dir: string): Promise<boolean>;
      confirmQuit(): void;
      createThemeFile(
        newTheme: FiddleTheme,
        name?: string,
      ): Promise<LoadedFiddleTheme>;
      deleteUserData(name: string): Promise<void>;
      downloadVersion(
        version: string,
        opts?: Partial<DownloadVersionParams>,
      ): Promise<void>;
      fetchVersions(): Promise<Version[]>;
      getAvailableThemes(): Promise<Array<LoadedFiddleTheme>>;
      getElectronTypes(ver: RunnableVersion): Promise<string | undefined>;
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
      getNodeTypes(
        version: string,
      ): Promise<{ version: string; types: NodeTypes } | undefined>;
      getOldestSupportedMajor(): number | undefined;
      getReleaseInfo(version: string): Promise<ReleaseInfo | undefined>;
      getReleasedVersions(): Array<Version>;
      getUsername(): string;
      getVersionState(version: string): InstallState;
      isDevMode: boolean;
      isReleasedMajor(major: number): Promise<boolean>;
      macTitlebarClicked(): void;
      onGetFiles(
        callback: (
          options: PackageJsonOptions | undefined,
          transforms: Array<FileTransformOperation>,
        ) => Promise<{ localPath?: string; files: Files }>,
      );
      openThemeFolder(): Promise<void>;
      packageRun(
        { dir, packageManager }: PMOperationOptions,
        command: string,
      ): Promise<string>;
      pathExists(path: string): boolean;
      platform: string;
      pushOutputEntry(entry: OutputEntry): void;
      readThemeFile(name: string): Promise<LoadedFiddleTheme | null>;
      reloadWindows(): void;
      removeAllListeners(type: FiddleEvent): void;
      removeVersion(version: string): Promise<InstallState>;
      saveFilesToTemp(files: Files): Promise<string>;
      selectLocalVersion: () => Promise<SelectedLocalVersion | undefined>;
      sendReady(): void;
      setNativeTheme(theme: 'dark' | 'light' | 'system'): void;
      setShowMeTemplate(template?: string): void;
      showWarningDialog(messageOptions: MessageOptions): void;
      showWindow(): void;
      startFiddle(params: StartFiddleParams): Promise<void>;
      stopFiddle(): void;
      taskDone(result: RunResult): void;
      themePath: string;
      uncacheTypes(ver: RunnableVersion): Promise<void>;
      unwatchElectronTypes(): Promise<void>;
    };
  }
}
