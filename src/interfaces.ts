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
  package?: string;
}

export interface ElectronVersion extends NpmVersion {
  state: ElectronVersionState;
  source: ElectronVersionSource;
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


export interface Templates {
  [index: string]: string | Templates;
}

export type EditorId = 'main' | 'renderer' | 'html';

export type ArrowPosition = 'top' | 'left' | 'bottom' | 'right';
