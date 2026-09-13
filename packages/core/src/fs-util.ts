import fs from 'node:fs/promises';
import os from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

let noAsarDepth = 0;
let savedNoAsar: boolean | undefined;

/**
 * Runs `fn` with `process.noAsar` set, so Electron's patched `fs` treats
 * `.asar` files as plain files. Safe to nest and to run concurrently.
 */
export async function withNoAsar<T>(fn: () => Promise<T>): Promise<T> {
  if (noAsarDepth++ === 0) {
    savedNoAsar = process.noAsar;
    process.noAsar = true;
  }
  try {
    return await fn();
  } finally {
    if (--noAsarDepth === 0) process.noAsar = savedNoAsar ?? false;
  }
}

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

/** How long {@link rename} retries a transient error. */
export const RENAME_RETRY_MS = 10_000;

/**
 * `fs.rename`, retried with backoff for up to 10 seconds on EPERM, EACCES and
 * EBUSY. On Windows, those come and go while a virus scanner or indexer has a
 * file open.
 */
export async function rename(from: string, to: string): Promise<void> {
  const start = Date.now();
  for (let delay = 50; ; delay = Math.min(delay * 2, 1000)) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const code = errorCode(err);
      const transient = code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
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

/** Deletes a folder, retrying busy files a few times, and ignores failures. */
export async function removeBestEffort(dir: string): Promise<void> {
  try {
    await withNoAsar(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 3 }));
  } catch {
    // a later sweep gets another try
  }
}

/** Writes `data` to `file` through a temp file and a rename. */
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
