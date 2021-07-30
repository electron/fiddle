export type Files = Map<string, string>;

export type FileTransform = (files: Files) => Promise<Files>;

export type VersionSource = 'local' | 'remote';

export type VersionState =
  | 'absent'
  | 'downloading'
  | 'installing'
  | 'installed';

export type GistActionType = 'Publish' | 'Update' | 'Delete';

export type GistActionState = 'publishing' | 'updating' | 'deleting' | 'none';

export interface Version {
  version: string;
  name?: string;
  localPath?: string;
}

export type RunResult =
  | 'success' // exit code === 0
  | 'failure' // ran, but exit code !== 0
  | 'invalid'; // could not run

export interface RunnableVersion extends Version {
  state: VersionState;
  source: VersionSource;
  downloadProgress?: number;
}

export type ElectronReleaseChannel = 'Nightly' | 'Beta' | 'Stable';

export interface SetFiddleOptions {
  filePath?: string;
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

export interface BisectRequest {
  setup: SetupRequest;
  goodVersion: string;
  badVersion: string;
}

export interface TestRequest {
  setup: SetupRequest;
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

export interface Templates {
  [index: string]: string | Templates;
}

export const enum GenericDialogType {
  'confirm' = 'confirm',
  'warning' = 'warning',
  'success' = 'success',
}

export type EditorId = `${string}.${'js' | 'html' | 'css'}`;

export type EditorValues = Record<EditorId, string>;

// Default Editors
export enum DefaultEditorId {
  'main' = 'main.js',
  'renderer' = 'renderer.js',
  'html' = 'index.html',
  'preload' = 'preload.js',
  'css' = 'styles.css',
}

export const DEFAULT_EDITORS = [
  DefaultEditorId.main,
  DefaultEditorId.renderer,
  DefaultEditorId.preload,
  DefaultEditorId.html,
  DefaultEditorId.css,
];

// main.js gets special treatment: it is required as the entry point
// when we run fiddles or create a package.json to package fiddles.
export const MAIN_JS = DefaultEditorId.main;

export const PACKAGE_NAME = 'package.json';

export type ArrowPosition = 'top' | 'left' | 'bottom' | 'right';

export const enum BlockableAccelerator {
  save = 'save',
  saveAs = 'saveAs',
}
