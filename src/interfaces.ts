export type ElectronVersionState = 'downloading' | 'ready' | 'unknown';

export type WindowNames = 'main';

export type Files = Map<string, string>;

export type FileTransform = (files: Files) => Promise<Files>;

export interface GitHubVersion {
  url: string;
  assets_url: string;
  html_url: string;
  tag_name: string;
  target_commitish: string;
  name: string;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  body: string;
}

export interface EditorValues {
  main: string;
  renderer: string;
  html: string;
  package?: string;
}

export interface ElectronVersion extends GitHubVersion {
  state: ElectronVersionState;
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

export type EditorId = 'main' | 'renderer' | 'html';

export type ArrowPosition = 'top' | 'left' | 'bottom' | 'right';
