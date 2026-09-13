/** The versioned `core` cache (REQUIREMENTS §5): `<OS cache dir>/Electron Fiddle/cache-v1/`, or `<test dir>/cache` in test mode. */
import path from 'node:path';

import { getCacheRoot } from '../test-mode';

export interface CachePaths {
  root: string;
  /** The cached release list. */
  releases: string;
  /** One immutable folder per installed version: `electron/<version>/`. */
  electron: string;
  /** Downloaded zips, before they are unpacked. */
  downloads: string;
  /** `types/electron/<version>.d.ts` and `types/node/<version>.json`. */
  types: string;
}

/** Call after main's entry has run, like `getCacheRoot()`. */
export function cachePaths(root = getCacheRoot()): CachePaths {
  return {
    root,
    releases: path.join(root, 'releases.json'),
    electron: path.join(root, 'electron'),
    downloads: path.join(root, 'downloads'),
    types: path.join(root, 'types'),
  };
}
