import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FiddleCoreError, LOCK_STALE_MS, acquireLock, withLock } from '../src/index.js';
import { isLockStale } from '../src/lock.js';

// Lets a test act between a waiter judging a lock stale and moving it aside.
const hooks = vi.hoisted(() => ({
  beforeRename: undefined as ((from: string) => void) | undefined,
}));
vi.mock('../src/fs-util.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/fs-util.js')>();
  return {
    ...actual,
    rename: (from: string, to: string) => {
      hooks.beforeRename?.(from);
      return actual.rename(from, to);
    },
  };
});

/** The pid of a process that has already exited. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((resolve) => child.once('exit', resolve));
  return child.pid!;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('locks', () => {
  let tmpdir: string;
  let lockPath: string;

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-lock-'));
    lockPath = path.join(tmpdir, 'sub', 'thing.lock');
  });

  afterEach(() => {
    hooks.beforeRename = undefined;
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  function writeLock(contents: string | object, mtime?: Date): void {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(
      lockPath,
      typeof contents === 'string' ? contents : JSON.stringify(contents),
    );
    if (mtime) fs.utimesSync(lockPath, mtime, mtime);
  }

  const longAgo = () => new Date(Date.now() - LOCK_STALE_MS - 60_000);

  it('creates a lock file holding pid, hostname and startedAt', async () => {
    const lock = await acquireLock(lockPath);
    expect(JSON.parse(fs.readFileSync(lockPath, 'utf8'))).toStrictEqual({
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: expect.any(Number),
    });
    await lock.release();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('waits for a held lock to be released', async () => {
    const first = await acquireLock(lockPath);
    let acquired = false;
    const second = acquireLock(lockPath, { pollMs: 10 }).then((lock) => {
      acquired = true;
      return lock;
    });
    await sleep(50);
    expect(acquired).toBe(false);

    await first.release();
    await (await second).release();
    expect(acquired).toBe(true);
  });

  it('rejects with a `locked` error after timeoutMs', async () => {
    const first = await acquireLock(lockPath);
    const pending = acquireLock(lockPath, { timeoutMs: 50, pollMs: 10 });
    await expect(pending).rejects.toBeInstanceOf(FiddleCoreError);
    await expect(pending).rejects.toMatchObject({ code: 'locked' });
    await first.release();
  });

  it('rejects with an `aborted` error when its signal aborts', async () => {
    const first = await acquireLock(lockPath);
    const controller = new AbortController();
    const pending = acquireLock(lockPath, { signal: controller.signal, pollMs: 10 });
    setTimeout(() => controller.abort(), 20);
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
    await first.release();
  });

  it('recovers a stale lock whose process is dead', async () => {
    writeLock({ pid: await deadPid(), hostname: os.hostname(), startedAt: Date.now() });
    const lock = await acquireLock(lockPath, { timeoutMs: 1000 });
    expect(lock.info.pid).toBe(process.pid);
    await lock.release();
  });

  it('trusts a live process on this host, however old its lock', async () => {
    writeLock({ pid: process.pid, hostname: os.hostname(), startedAt: 0 }, longAgo());
    await expect(
      acquireLock(lockPath, { timeoutMs: 50, pollMs: 10 }),
    ).rejects.toMatchObject({ code: 'locked' });
  });

  it('does not check the pid of a lock from another host', async () => {
    writeLock({
      pid: await deadPid(),
      hostname: 'some-other-host',
      startedAt: Date.now(),
    });
    await expect(
      acquireLock(lockPath, { timeoutMs: 50, pollMs: 10 }),
    ).rejects.toMatchObject({
      code: 'locked',
    });
  });

  it('recovers a lock from another host once its mtime is older than staleMs', async () => {
    writeLock({ pid: 1, hostname: 'some-other-host', startedAt: 0 }, longAgo());
    const lock = await acquireLock(lockPath, { timeoutMs: 1000 });
    expect(lock.info.hostname).toBe(os.hostname());
    await lock.release();
  });

  it('gives an unreadable lock a grace period before treating it as stale', async () => {
    writeLock('');
    await expect(
      acquireLock(lockPath, { timeoutMs: 50, pollMs: 10 }),
    ).rejects.toMatchObject({
      code: 'locked',
    });

    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lockPath, old, old);
    const lock = await acquireLock(lockPath, { timeoutMs: 1000 });
    await lock.release();
  });

  it('refreshes the mtime of a held lock every staleMs / 3, until released', async () => {
    const lock = await acquireLock(lockPath, { staleMs: 300 });
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(lockPath, past, past);
    await expect
      .poll(() => fs.statSync(lockPath).mtimeMs, { timeout: 2000 })
      .toBeGreaterThan(past.getTime() + 30_000);

    await lock.release();
    writeLock('placeholder', past);
    await sleep(300);
    expect(fs.statSync(lockPath).mtimeMs).toBeLessThan(past.getTime() + 1000);
  });

  it('puts back a lock that another waiter replaced before this one moved it aside', async () => {
    writeLock({ pid: await deadPid(), hostname: os.hostname(), startedAt: 0 });
    const live = { pid: process.pid, hostname: os.hostname(), startedAt: Date.now() };
    let raced = false;
    hooks.beforeRename = (from) => {
      if (from !== lockPath || raced) return;
      // another waiter removed the stale lock and took the lock itself
      raced = true;
      fs.writeFileSync(lockPath, JSON.stringify(live));
    };

    await expect(
      acquireLock(lockPath, { timeoutMs: 100, pollMs: 10 }),
    ).rejects.toMatchObject({ code: 'locked' });
    expect(raced).toBe(true);
    expect(JSON.parse(fs.readFileSync(lockPath, 'utf8'))).toStrictEqual(live);
    expect(fs.readdirSync(path.dirname(lockPath))).toStrictEqual(['thing.lock']);
  });

  it('lets only one of two waiters take over a stale lock', async () => {
    const dead = await deadPid();
    let holders = 0;
    let most = 0;
    const hold = () =>
      withLock(lockPath, { pollMs: 1 }, async () => {
        most = Math.max(most, ++holders);
        await sleep(2);
        holders--;
      });
    for (let round = 0; round < 50; round++) {
      writeLock({ pid: dead, hostname: os.hostname(), startedAt: round });
      await Promise.all([hold(), hold()]);
    }
    expect(most).toBe(1);
    expect(fs.readdirSync(path.dirname(lockPath))).toStrictEqual([]);
  });

  it('release() leaves alone a lock that someone else took over', async () => {
    const lock = await acquireLock(lockPath);
    writeLock({ ...lock.info, startedAt: lock.info.startedAt + 1 });
    await lock.release();
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it('withLock() releases the lock when its function throws', async () => {
    const fn = async () => {
      expect(fs.existsSync(lockPath)).toBe(true);
      throw new Error('boom');
    };
    await expect(withLock(lockPath, {}, fn)).rejects.toThrow('boom');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('waits on a lock held by another live process, then recovers it when that process dies', async () => {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    const script = `
      const fs = require('node:fs');
      const os = require('node:os');
      const info = { pid: process.pid, hostname: os.hostname(), startedAt: Date.now() };
      fs.writeFileSync(process.argv[1], JSON.stringify(info), { flag: 'wx' });
      process.stdout.write('locked\\n');
      setInterval(() => {}, 1000);
    `;
    const child = spawn(process.execPath, ['-e', script, lockPath], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise((resolve) => child.stdout.once('data', resolve));

    await expect(
      acquireLock(lockPath, { timeoutMs: 100, pollMs: 10 }),
    ).rejects.toMatchObject({
      code: 'locked',
    });

    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;

    const lock = await acquireLock(lockPath, { timeoutMs: 1000, pollMs: 10 });
    expect(lock.info.pid).toBe(process.pid);
    await lock.release();
  });

  describe('isLockStale()', () => {
    const now = 1_000_000_000;
    const mine = { pid: process.pid, hostname: os.hostname(), startedAt: 0 };
    const remote = { ...mine, hostname: 'some-other-host' };

    it('trusts the pid of a lock from this host, whatever its age', () => {
      expect(isLockStale({ info: mine, mtimeMs: 0 }, LOCK_STALE_MS, now)).toBe(false);
    });

    it('goes by the mtime of a lock from another host', () => {
      const fresh = { info: remote, mtimeMs: now - 1000 };
      const old = { info: remote, mtimeMs: now - LOCK_STALE_MS - 1 };
      expect(isLockStale(fresh, LOCK_STALE_MS, now)).toBe(false);
      expect(isLockStale(old, LOCK_STALE_MS, now)).toBe(true);
    });
  });
});
