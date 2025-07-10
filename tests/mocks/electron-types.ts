import { vi } from 'vitest';

export class ElectronTypesMock {
  public setVersion = vi.fn();
  public uncache = vi.fn();
}

export interface NodeTypesFile {
  path: string;
  type: string;
  contentType: string;
  integrity: string;
  lastModified: string;
  size: number;
}

export interface NodeTypesDirectory {
  path: string;
  type: string;
  files: NodeTypesMock[];
}

export type NodeTypesMock = NodeTypesFile | NodeTypesDirectory;
