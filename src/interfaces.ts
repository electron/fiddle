import type { Mirrors } from '@electron/fiddle-core';
export type {
  InstallStateEvent,
  ProgressObject,
  ReleaseInfo,
  SemVer,
} from '@electron/fiddle-core';

export type Files = Map<string, string>;

export type FileTransform = (
  files: Files,
  version: RunnableVersion,
) => Promise<Files>;

export type FileTransformOperation = 'dotfiles' | 'forge';

export enum VersionSource {
  remote = 'remote',
  local = 'local',
}

export enum GistActionType {
  publish = 'Publish',
  update = 'Update',
  delete = 'Delete',
}

export enum GistActionState {
  publishing = 'publishing',
  updating = 'updating',
  deleting = 'deleting',
  none = 'none',
}

export interface Version {
  version: string;
  name?: string;
  localPath?: string;
}

export enum InstallState {
  missing = 'missing',
  downloading = 'downloading',
  downloaded = 'downloaded',
  installing = 'installing',
  installed = 'installed',
}

export enum RunResult {
  SUCCESS = 'success', // exit code === 0
  FAILURE = 'failure', // ran, but exit code !== 0
  INVALID = 'invalid', // could not run
}

export interface RunnableVersion extends Version {
  state: InstallState;
  source: VersionSource;
  downloadProgress?: number;
}

export const enum ElectronReleaseChannel {
  stable = 'Stable',
  beta = 'Beta',
  nightly = 'Nightly',
}

export interface SetLocalFiddleOptions {
  filePath: string;
  files: Record<string, string>;
}

export interface SetFiddleOptions {
  localFiddle?: SetLocalFiddleOptions;
  templateName?: string;
  gistId?: string;
}

export interface SetUpMenuOptions {
  acceleratorsToBlock?: BlockableAccelerator[] | null;
  activeTemplate?: string | null;
}

export interface SetupRequest {
  fiddle?: SetFiddleOptions;
  version?: string;
  showChannels: ElectronReleaseChannel[];
  hideChannels: ElectronReleaseChannel[];
  useObsolete?: boolean;
}

export interface OutputEntry {
  text: string;
  timeString: string;
  isNotPre?: boolean;
}

export interface OutputOptions {
  bypassBuffer?: boolean;
  isNotPre?: boolean;
}

export interface GenericDialogOptions {
  type: GenericDialogType;
  ok: string;
  cancel?: string;
  wantsInput: boolean;
  defaultInput?: string;
  label: string | JSX.Element;
  placeholder?: string;
}

export interface Contributor {
  url: string;
  api: string;
  login: string;
  avatar: string;
  name: string | null;
  bio: string | null;
  location: string | null;
}

export interface Templates {
  [index: string]: string | Templates;
}

export const enum GenericDialogType {
  'confirm' = 'confirm',
  'warning' = 'warning',
  'success' = 'success',
}

export type EditorId = `${string}.${
  | 'cjs'
  | 'js'
  | 'mjs'
  | 'html'
  | 'css'
  | 'json'}`;

export type EditorValues = Record<EditorId, string>;

// main.{cjs,js,mjs} gets special treatment: it is required as the entry point
// when we run fiddles or create a package.json to package fiddles.
export const MAIN_CJS = 'main.cjs';
export const MAIN_JS = 'main.js';
export const MAIN_MJS = 'main.mjs';

export const PACKAGE_NAME = 'package.json';

export type ArrowPosition = 'top' | 'left' | 'bottom' | 'right';

export const enum BlockableAccelerator {
  save = 'save',
  saveAs = 'saveAs',
}

export interface SelectedLocalVersion {
  folderPath: string;
  isValidElectron: boolean;
  localName?: string;
  token: string;
  existingVersion?: Version;
}

export type FiddleEvent =
  | 'before-quit'
  | 'clear-console'
  | 'electron-types-changed'
  | 'execute-monaco-command'
  | 'fiddle-runner-output'
  | 'fiddle-modules-installed'
  | 'fiddle-stopped'
  | 'is-auto-bisecting'
  | 'load-example'
  | 'load-gist'
  | 'make-fiddle'
  | 'new-fiddle'
  | 'new-test'
  | 'open-fiddle'
  | 'open-settings'
  | 'open-template'
  | 'package-fiddle'
  | 'redo-in-editor'
  | 'run-fiddle'
  | 'save-fiddle-gist'
  | 'saved-local-fiddle'
  | 'select-all-in-editor'
  | 'set-show-me-template'
  | 'show-welcome-tour'
  | 'toggle-bisect'
  | 'toggle-monaco-option'
  | 'undo-in-editor'
  | 'version-download-progress'
  | 'version-state-changed';

export interface MessageOptions {
  message: string;
  detail?: string;
  buttons?: string[];
}

export type IPackageManager = 'npm' | 'yarn';

export interface PMOperationOptions {
  dir: string;
  packageManager: IPackageManager;
  useSocketFirewall?: boolean;
}

export interface GistRevision {
  sha: string;
  date: string;
  title: string;
  changes: {
    deletions: number;
    additions: number;
    total: number;
  };
}

export interface GistLoadParams {
  id: string;
  revision?: string;
}

export interface GistFile {
  filename: string;
  content: string;
}

export interface GistLoadResult {
  files: Record<string, GistFile>;
  revision?: string;
}

export interface GistUpdateParams {
  id: string;
  files: Record<string, GistFile>;
}

export interface GistWriteResult {
  id: string;
  url: string;
  revision?: string;
}

export enum GlobalSetting {
  acceleratorsToBlock = 'acceleratorsToBlock',
  channelsToShow = 'channelsToShow',
  electronMirror = 'electronMirror',
  environmentVariables = 'environmentVariables',
  executionFlags = 'executionFlags',
  fontFamily = 'fontFamily',
  fontSize = 'fontSize',
  gitHubLogin = 'gitHubLogin',
  gitHubToken = 'gitHubToken',
  hasShownTour = 'hasShownTour',
  isClearingConsoleOnRun = 'isClearingConsoleOnRun',
  isEnablingElectronLogging = 'isEnablingElectronLogging',
  isKeepingUserDataDirs = 'isKeepingUserDataDirs',
  isPublishingGistAsRevision = 'isPublishingGistAsRevision',
  isUsingSocketFirewall = 'isUsingSocketFirewall',
  isUsingSystemTheme = 'isUsingSystemTheme',
  knownVersion = 'known-electron-versions',
  localVersion = 'local-electron-versions',
  packageAuthor = 'packageAuthor',
  isShowingGistHistory = 'isShowingGistHistory',
  packageManager = 'packageManager',
  showObsoleteVersions = 'showObsoleteVersions',
  showUndownloadedVersions = 'showUndownloadedVersions',
  theme = 'theme',
}

export enum WindowSpecificSetting {
  gitHubPublishAsPublic = 'gitHubPublishAsPublic',
  version = 'version',
}

export interface AppStateBroadcastChannel extends BroadcastChannel {
  postMessage(params: AppStateBroadcastMessage): void;
}

export type AppStateBroadcastMessage =
  | {
      type: AppStateBroadcastMessageType.isDownloadingAll;
      payload: boolean;
    }
  | {
      type: AppStateBroadcastMessageType.syncVersions;
      payload: RunnableVersion[];
    };

export enum AppStateBroadcastMessageType {
  isDownloadingAll = 'isDownloadingAll',
  syncVersions = 'syncVersions',
}

export type NodeTypeDTS = `${string}.d.ts`;

export type NodeTypes = Record<NodeTypeDTS, string>;

export interface PackageJsonOptions {
  includeElectron?: boolean;
  includeDependencies?: boolean;
}

export interface StartFiddleOptions {
  version: string;
  enableElectronLogging: boolean;
  executionFlags: string[];
  env: { [x: string]: string | undefined };
  modules: Array<[string, string]>;
  packageManager: IPackageManager;
  useSocketFirewall: boolean;
  isKeepingUserDataDirs: boolean;
}

export interface DownloadVersionParams {
  mirror: Mirrors;
}
