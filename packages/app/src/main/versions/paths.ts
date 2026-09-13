/** The versioned `core` cache (REQUIREMENTS §5): `<OS cache dir>/Electron Fiddle/cache-v1/`. */
import os from 'node:os';
import path from 'node:path';

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

export function osCacheDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches');
  if (platform === 'win32') return env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return env.XDG_CACHE_HOME || path.join(home, '.cache');
}

export function cachePaths(root = path.join(osCacheDir(), 'Electron Fiddle', 'cache-v1')): CachePaths {
  return {
    root,
    releases: path.join(root, 'releases.json'),
    electron: path.join(root, 'electron'),
    downloads: path.join(root, 'downloads'),
    types: path.join(root, 'types'),
  };
}
