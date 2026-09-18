import nodeFs from 'node:fs/promises';
import os from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

// In Electron, `fs` reads `.asar` files as folders, so the asar files inside an
// Electron build can't be copied or deleted through it. `process.noAsar` turns
// that off, but for the whole app until the awaited work ends, which breaks
// reads of the app's own asar. `original-fs` has no asar support at all.
const fs: typeof nodeFs =
  (process.getBuiltinModule('original-fs') as { promises: typeof nodeFs } | undefined)
    ?.promises ?? nodeFs;

function errorCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException | undefined)?.code;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const RENAME_RETRY_MS = 10_000;

/**
 * `fs.rename`. On Windows, EPERM, EACCES and EBUSY come and go while a virus
 * scanner or indexer has a file open, so those are retried with backoff for up
 * to 10 seconds.
 */
export async function rename(from: string, to: string): Promise<void> {
  const start = Date.now();
  for (let delay = 50; ; delay = Math.min(delay * 2, 1000)) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const code = errorCode(err);
      const transient =
        process.platform === 'win32' &&
        (code === 'EPERM' || code === 'EACCES' || code === 'EBUSY');
      if (!transient || Date.now() - start + delay > RENAME_RETRY_MS) throw err;
      await sleep(delay);
    }
  }
}

/**
 * Renames the folder `tmp` to `dest`. If `dest` already exists, `tmp` is
 * deleted and the existing `dest` wins.
 */
export async function renameIntoPlace(tmp: string, dest: string): Promise<void> {
  try {
    await rename(tmp, dest);
  } catch (err) {
    if (!(await exists(dest))) throw err;
    await removeBestEffort(tmp);
  }
}

/** Copies a folder, treating `.asar` files inside it as plain files. */
export function copyFolder(
  source: string,
  dest: string,
  options: { verbatimSymlinks?: boolean } = {},
): Promise<void> {
  return fs.cp(source, dest, { recursive: true, ...options });
}

/** Deletes a file or folder, retrying busy files a few times. Nothing there is not an error. */
export function remove(target: string): Promise<void> {
  return fs.rm(target, { recursive: true, force: true, maxRetries: 3 });
}

/** {@link remove}, but failures are ignored. */
export async function removeBestEffort(target: string): Promise<void> {
  try {
    await remove(target);
  } catch {
    // a later sweep gets another try
  }
}

export async function writeFileAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmp, data, 'utf8');
    await rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

/** `os.hostname()`, made safe for a file name. It never contains `_`. */
export function safeHostname(): string {
  return os.hostname().replace(/[^A-Za-z0-9.-]/g, '-');
}
