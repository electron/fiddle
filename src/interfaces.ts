export type Files = Map<string, string>;

export type FileTransform = (files: Files) => Promise<Files>;

export enum VersionState {
  ready = 'ready',
  downloading = 'downloading',
  unzipping = 'unzipping',
  unknown = 'unknown',
}

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

export interface EditorValues {
  main: string;
  renderer: string;
  html: string;
  preload: string;
  css: string;
  package?: string;
}

export enum RunResult {
  SUCCESS = 'success', // exit code === 0
  FAILURE = 'failure', // ran, but exit code !== 0
  INVALID = 'invalid', // could not run
}

export interface RunnableVersion extends Version {
  state: VersionState;
  source: VersionSource;
  downloadProgress?: number;
}

export const enum ElectronReleaseChannel {
  stable = 'Stable',
  beta = 'Beta',
  nightly = 'Nightly',
}

export interface SetFiddleOptions {
  filePath?: string;
  templateName?: string;
  gistId?: string;
}

export interface SetupRequest {
  fiddle?: SetFiddleOptions;
  version?: string;
  showChannels: ElectronReleaseChannel[];
  hideChannels: ElectronReleaseChannel[];
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
  timestamp: number;
  isNotPre?: boolean;
}

export interface OutputOptions {
  bypassBuffer?: boolean;
  isNotPre?: boolean;
}

export interface GenericDialogOptions {
  type: GenericDialogType;
  ok?: string;
  cancel?: string;
  wantsInput?: boolean;
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

// Default Editors
export const enum DefaultEditorId {
  'main' = 'main.js',
  'renderer' = 'renderer.js',
  'html' = 'index.html',
  'preload' = 'preload.js',
  'css' = 'styles.css',
}

export type CustomEditorId = `${string}.${'js' | 'html' | 'css'}`;

export type EditorId = DefaultEditorId | CustomEditorId;

// Panels that can show up as a mosaic
export const enum PanelId {
  'docsDemo' = 'docsDemo',
}

export type MosaicId = DefaultEditorId | PanelId | CustomEditorId;

export const DEFAULT_EDITORS = [
  DefaultEditorId.main,
  DefaultEditorId.renderer,
  DefaultEditorId.preload,
  DefaultEditorId.html,
  DefaultEditorId.css,
];

export const ALL_PANELS = [PanelId.docsDemo];
export const ALL_MOSAICS = [...DEFAULT_EDITORS, ...ALL_PANELS] as MosaicId[];

export type ArrowPosition = 'top' | 'left' | 'bottom' | 'right';

export const enum DocsDemoPage {
  DEFAULT = 'DEFAULT',
  DEMO_APP = 'DEMO_APP',
}

export const enum BlockableAccelerator {
  save = 'save',
  saveAs = 'saveAs',
}
