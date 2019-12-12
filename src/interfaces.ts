export type WindowNames = 'main';

export type Files = Map<string, string>;

export type FileTransform = (files: Files) => Promise<Files>;

export enum ElectronVersionState {
  ready = 'ready',
  downloading = 'downloading',
  unknown = 'unknown'
}

export enum ElectronVersionSource {
  remote = 'remote',
  local = 'local'
}
export interface NpmVersion {
  version: string;
  name?: string;
  localPath?: string;
}

export interface EditorValues {
  main: string;
  renderer: string;
  html: string;
  preload: string;
  package?: string;
}

export interface ElectronVersion extends NpmVersion {
  state: ElectronVersionState;
  source: ElectronVersionSource;
}

export interface SetFiddleOptions {
  filePath?: string;
  templateName?: string;
  gistId?: string;
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

export interface WarningDialogTexts {
  ok?: string;
  cancel?: string;
  label: string;
}

export interface Templates {
  [index: string]: string | Templates;
}

// Editors
export const enum EditorId {
  'main' = 'main',
  'renderer' = 'renderer',
  'html' = 'html',
  'preload' = 'preload'
}

// Panels that can show up as a mosaic
export const enum PanelId {
  'docsDemo' = 'docsDemo'
}

export type MosaicId = EditorId | PanelId;

export const ALL_EDITORS =  [ EditorId.main, EditorId.renderer, EditorId.preload, EditorId.html ];
export const ALL_PANELS = [ PanelId.docsDemo ];
export const ALL_MOSAICS = [ ...ALL_EDITORS, ...ALL_PANELS ];

export type ArrowPosition = 'top' | 'left' | 'bottom' | 'right';

export const enum DocsDemoPage {
  DEFAULT = 'DEFAULT',
  DEMO_APP = 'DEMO_APP'
}
