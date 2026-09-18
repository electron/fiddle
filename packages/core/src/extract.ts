import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import debug from 'debug';

const d = debug('fiddle-core:extract');

const run = promisify(execFile);

type Extract = (zipPath: string, dir: string, signal?: AbortSignal) => Promise<void>;

/**
 * Windows' own `tar.exe` (bsdtar, part of Windows 10 since 1803) reads zips.
 * It runs as a child process, so it neither blocks the event loop nor goes
 * through Electron's asar-aware `fs`, which can't write the `.asar` files that
 * an Electron build contains. The full path keeps a GNU `tar` earlier on
 * `PATH`, which can't read zips, from being picked up.
 */
const extractWithTar: Extract = async (zipPath, dir, signal) => {
  const tar = path.win32.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'tar.exe',
  );
  await run(tar, ['-xf', zipPath, '-C', dir], { windowsHide: true, signal });
};

/**
 * The native addon's `extract`. `@electron-internal/extract-zip` has no
 * win32-ia32 build, so where the addon does not load, Windows falls back to
 * `tar.exe`, and any other platform reports the load error. Loaded on first
 * use, so importing core never loads the addon.
 */
async function loadExtract(): Promise<Extract> {
  try {
    const { extract } = await import('@electron-internal/extract-zip');
    return (zipPath, dir) => extract(zipPath, { dir });
  } catch (error) {
    if (process.platform !== 'win32') throw error;
    d('the native zip addon did not load, using tar.exe: %O', error);
    return extractWithTar;
  }
}

/** Extracts the zip at `zipPath` into `dir`, an existing absolute path. */
export async function extractZip(
  zipPath: string,
  dir: string,
  signal?: AbortSignal,
): Promise<void> {
  const extract = await loadExtract();
  await extract(zipPath, dir, signal);
}
