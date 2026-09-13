import fs from 'node:fs/promises';
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
    if (--noAsarDepth === 0) process.noAsar = savedNoAsar;
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

/**
 * Renames the folder `tmp` to `dest`. If another process got there first,
 * `tmp` is deleted and the existing `dest` wins. Transient Windows errors are
 * retried with backoff.
 */
export async function renameIntoPlace(tmp: string, dest: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, dest);
      return;
    } catch (err) {
      if (await exists(dest)) {
        await withNoAsar(() => fs.rm(tmp, { recursive: true, force: true }));
        return;
      }
      const code = errorCode(err);
      const transient = code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
      if (!transient || attempt >= 6) throw err;
      await sleep(50 * 2 ** attempt);
    }
  }
}

/** Writes `data` to `file` through a temp file and a rename. */
export async function writeFileAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}
