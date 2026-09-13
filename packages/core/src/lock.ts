import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { FiddleCoreError, abortError, throwIfAborted } from './errors.js';

/** The contents of a lock file. */
export interface LockInfo {
  pid: number;
  hostname: string;
  /** Milliseconds since the epoch. */
  startedAt: number;
}

export interface LockOptions {
  /** Stop waiting and reject with an `aborted` error. */
  signal?: AbortSignal;
  /**
   * Reject with a `locked` error if the lock is still held after this many
   * milliseconds. By default, waits until the lock is released or goes stale.
   */
  timeoutMs?: number;
  /** How often to retry a held lock. Default: 100 ms. */
  pollMs?: number;
  /** Age after which a lock is stale. Default: {@link LOCK_STALE_MS}. */
  staleMs?: number;
}

/** A lock older than this is stale, even if its process is still alive. */
export const LOCK_STALE_MS = 10 * 60 * 1000;

// A lock file with unreadable contents is probably still being written.
// Give its writer this long before treating it as stale.
const UNREADABLE_GRACE_MS = 5_000;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function parseLockInfo(text: string): LockInfo | undefined {
  try {
    const val = JSON.parse(text) as Partial<LockInfo>;
    if (
      typeof val.pid === 'number' &&
      typeof val.hostname === 'string' &&
      typeof val.startedAt === 'number'
    ) {
      return { pid: val.pid, hostname: val.hostname, startedAt: val.startedAt };
    }
  } catch {
    // fall through
  }
  return undefined;
}

/** Reads a lock file. Returns `undefined` if there is no lock. */
export async function readLock(
  lockPath: string,
): Promise<{ info: LockInfo | undefined; mtimeMs: number } | undefined> {
  try {
    const [text, st] = await Promise.all([
      fs.readFile(lockPath, 'utf8'),
      fs.stat(lockPath),
    ]);
    return { info: parseLockInfo(text), mtimeMs: st.mtimeMs };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

/**
 * A lock is stale when its process is dead (checked only on this host) or
 * when it is older than `staleMs`.
 */
export function isLockStale(
  info: LockInfo,
  staleMs = LOCK_STALE_MS,
  now = Date.now(),
): boolean {
  if (now - info.startedAt > staleMs) return true;
  return info.hostname === os.hostname() && !isProcessAlive(info.pid);
}

/** A held lock. Call {@link Lock.release} when done. */
export class Lock {
  constructor(
    public readonly path: string,
    public readonly info: LockInfo,
  ) {}

  /** Removes the lock file, unless another process has since taken it over. */
  public async release(): Promise<void> {
    const current = await readLock(this.path);
    if (
      current?.info?.pid === this.info.pid &&
      current.info.hostname === this.info.hostname &&
      current.info.startedAt === this.info.startedAt
    ) {
      await fs.rm(this.path, { force: true });
    }
  }
}

/**
 * Acquires a cross-process lock file at `lockPath`.
 *
 * The file is created with `O_EXCL` and holds a {@link LockInfo}. A held lock
 * is waited on; a stale one is removed and retried.
 */
export async function acquireLock(
  lockPath: string,
  opts: LockOptions = {},
): Promise<Lock> {
  const { signal, timeoutMs, pollMs = 100, staleMs = LOCK_STALE_MS } = opts;
  const start = Date.now();
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  for (;;) {
    throwIfAborted(signal);
    const info: LockInfo = {
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: Date.now(),
    };
    try {
      await fs.writeFile(lockPath, JSON.stringify(info), { flag: 'wx' });
      return new Lock(lockPath, info);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }

    const held = await readLock(lockPath);
    if (!held) continue; // released between our attempt and our read
    const now = Date.now();
    const stale = held.info
      ? isLockStale(held.info, staleMs, now)
      : now - held.mtimeMs > UNREADABLE_GRACE_MS;
    if (stale) {
      await fs.rm(lockPath, { force: true });
      continue;
    }

    if (timeoutMs !== undefined && now - start >= timeoutMs) {
      const owner = held.info
        ? `process ${held.info.pid} on ${held.info.hostname}`
        : 'another process';
      throw new FiddleCoreError('locked', `"${lockPath}" is locked by ${owner}`);
    }

    try {
      await sleep(pollMs, undefined, { signal });
    } catch {
      throw abortError(signal);
    }
  }
}

/** Runs `fn` while holding the lock at `lockPath`. */
export async function withLock<T>(
  lockPath: string,
  opts: LockOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = await acquireLock(lockPath, opts);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
