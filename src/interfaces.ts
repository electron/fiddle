export interface StringMap<T> {
  [x: string]: T;
}

export type ElectronVersionState = 'downloading' | 'ready' | 'unknown';

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

export interface ElectronVersion extends GitHubVersion {
  state: ElectronVersionState
}

export interface OutputEntry {
  text: string;
  timestamp: number;
}