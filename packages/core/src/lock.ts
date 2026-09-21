import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { abortError, throwIfAborted } from './errors.js';

export interface LockInfo {
  pid: number;
  hostname: string;
  /** Milliseconds since the epoch. */
  startedAt: number;
}

export interface LockOptions {
  /** Stop waiting and reject with an `aborted` error. */
  signal?: AbortSignal;
  /** How often to retry a held lock. Default: 100 ms. */
  pollMs?: number;
  /**
   * Age after which a lock is stale, if its file hasn't been touched. A held
   * lock refreshes its file's mtime every third of this. Default:
   * {@link LOCK_STALE_MS}.
   */
  staleMs?: number;
}

/**
 * A lock is stale once its file hasn't been touched for this long. While a lock
 * is held, its mtime is refreshed every third of this.
 */
export const LOCK_STALE_MS = 10 * 60 * 1000;

// A lock file with unreadable contents is probably still being written.
// Give its writer this long before treating it as stale.
const UNREADABLE_GRACE_MS = 5_000;

export function isProcessAlive(pid: number): boolean {
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

export interface HeldLock {
  text: string;
  /** `undefined` if the contents can't be parsed. */
  info: LockInfo | undefined;
  mtimeMs: number;
}

// On Windows, a file that is being deleted can't be opened or created again
// until its last handle closes. Both fail with EPERM for that moment.
function isVanishing(err: unknown): boolean {
  return process.platform === 'win32' && (err as NodeJS.ErrnoException).code === 'EPERM';
}

/** Reads a lock file. Returns `undefined` if there is no lock. */
export async function readLock(lockPath: string): Promise<HeldLock | undefined> {
  try {
    const [text, st] = await Promise.all([
      fs.readFile(lockPath, 'utf8'),
      fs.stat(lockPath),
    ]);
    return { text, info: parseLockInfo(text), mtimeMs: st.mtimeMs };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT' || isVanishing(err))
      return undefined;
    throw err;
  }
}

/**
 * Whether a lock is stale:
 * - A lock from this host is stale when its process is dead.
 * - Any lock is stale when its file hasn't been touched for `staleMs`, because
 *   its owner stopped refreshing it. On this host that catches a dead owner's
 *   pid having been reused by an unrelated process.
 * - A lock that can't be parsed is stale after a short grace period.
 */
export function isLockStale(
  held: Pick<HeldLock, 'info' | 'mtimeMs'>,
  staleMs = LOCK_STALE_MS,
  now = Date.now(),
): boolean {
  const { info, mtimeMs } = held;
  if (!info) return now - mtimeMs > UNREADABLE_GRACE_MS;
  if (info.hostname === os.hostname() && !isProcessAlive(info.pid)) return true;
  return now - mtimeMs > staleMs;
}

/** A held lock. Call {@link Lock.release} when done. */
export class Lock {
  private readonly heartbeat: NodeJS.Timeout | undefined;

  /** With `staleMs`, the lock file's mtime is refreshed every `staleMs / 3`. */
  constructor(
    public readonly path: string,
    public readonly info: LockInfo,
    staleMs?: number,
  ) {
    if (staleMs) {
      this.heartbeat = setInterval(() => {
        const now = new Date();
        fs.utimes(path, now, now).catch(() => {});
      }, staleMs / 3);
      this.heartbeat.unref();
    }
  }

  /** Removes the lock file, unless another process has since taken it over. */
  public async release(): Promise<void> {
    clearInterval(this.heartbeat);
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

// A takeover guard left by a waiter that died is ignored after this long.
const TAKEOVER_GUARD_MS = 10_000;

/**
 * Deletes a stale lock, unless it has since been replaced. Takeovers hold a
 * guard folder, so a waiter can't delete a lock that another waiter took after
 * the first judged the old one stale. Returns false when another waiter holds
 * the guard, so the caller should wait and look again.
 */
async function removeStaleLock(lockPath: string, staleText: string): Promise<boolean> {
  const guard = `${lockPath}.takeover`;
  try {
    await fs.mkdir(guard);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST' && !isVanishing(err)) throw err;
    const st = await fs.stat(guard).catch(() => undefined);
    if (st && Date.now() - st.mtimeMs > TAKEOVER_GUARD_MS) {
      await fs.rmdir(guard).catch(() => {});
    }
    return false;
  }
  try {
    if ((await readLock(lockPath))?.text === staleText) {
      await fs.rm(lockPath, { force: true });
    }
  } finally {
    await fs.rmdir(guard).catch(() => {});
  }
  return true;
}

/**
 * Acquires a cross-process lock file at `lockPath`.
 *
 * The file is created with `O_EXCL` and holds a {@link LockInfo}. A held lock
 * is waited on; a stale one is deleted and retried. While held, the file's
 * mtime is refreshed so other processes can tell it is still in use.
 */
export async function acquireLock(
  lockPath: string,
  opts: LockOptions = {},
): Promise<Lock> {
  const { signal, pollMs = 100, staleMs = LOCK_STALE_MS } = opts;
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  for (;;) {
    throwIfAborted(signal);
    const info: LockInfo = {
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: Date.now(),
    };
    let vanishing: boolean;
    try {
      await fs.writeFile(lockPath, JSON.stringify(info), { flag: 'wx' });
      return new Lock(lockPath, info, staleMs);
    } catch (err) {
      vanishing = isVanishing(err);
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST' && !vanishing) throw err;
    }

    const held = await readLock(lockPath);
    if (!held && !vanishing) continue; // released between our attempt and our read
    if (
      held &&
      isLockStale(held, staleMs) &&
      (await removeStaleLock(lockPath, held.text))
    ) {
      continue;
    }

    try {
      await sleep(pollMs, undefined, { signal });
    } catch {
      throw abortError(signal);
    }
  }
}

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
