import os from 'node:os';
import path from 'node:path';

export interface Paths {
  // folder where electron zipfiles will be cached
  readonly electronDownloads: string;

  // folder where an electron download will be unzipped to be run
  readonly electronInstall: string;

  // folder where fiddles will be saved
  readonly fiddles: string;

  // file where electron releases are cached
  readonly versionsCache: string;

  // folder holding one immutable folder per installed version, used by the
  // Installer's 'per-version' layout. Optional; defaults to a `versions`
  // folder next to `electronInstall`.
  readonly electronVersions?: string;
}

/** Same locations as the `env-paths` package, which fiddle-core 2.x used. */
function envPaths(name: string): { data: string; cache: string } {
  const home = os.homedir();
  const { env } = process;
  if (process.platform === 'darwin') {
    const library = path.join(home, 'Library');
    return {
      data: path.join(library, 'Application Support', name),
      cache: path.join(library, 'Caches', name),
    };
  }
  if (process.platform === 'win32') {
    const localAppData = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return {
      data: path.join(localAppData, name, 'Data'),
      cache: path.join(localAppData, name, 'Cache'),
    };
  }
  return {
    data: path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), name),
    cache: path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), name),
  };
}

const paths = envPaths('fiddle-core');

export const DefaultPaths: Paths = {
  electronDownloads: path.join(paths.data, 'electron', 'zips'),
  electronInstall: path.join(paths.data, 'electron', 'current'),
  fiddles: path.join(paths.cache, 'fiddles'),
  versionsCache: path.join(paths.cache, 'releases.json'),
};
