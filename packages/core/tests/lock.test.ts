import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FiddleCoreError, LOCK_STALE_MS, acquireLock, withLock } from '../src/index.js';
import { isLockStale } from '../src/lock.js';

/** The pid of a process that has already exited. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((resolve) => child.once('exit', resolve));
  return child.pid!;
}

describe('locks', () => {
  let tmpdir: string;
  let lockPath: string;

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-lock-'));
    lockPath = path.join(tmpdir, 'sub', 'thing.lock');
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  function writeLock(contents: string | object): void {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(
      lockPath,
      typeof contents === 'string' ? contents : JSON.stringify(contents),
    );
  }

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
    await new Promise((resolve) => setTimeout(resolve, 50));
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

  it('recovers a lock older than 10 minutes, even if its process is alive', async () => {
    writeLock({
      pid: process.pid,
      hostname: os.hostname(),
      startedAt: Date.now() - LOCK_STALE_MS - 1000,
    });
    const lock = await acquireLock(lockPath, { timeoutMs: 1000 });
    await lock.release();
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
    const info = { pid: process.pid, hostname: os.hostname(), startedAt: now };

    it('is false for a fresh lock held by a live process', () => {
      expect(isLockStale(info, LOCK_STALE_MS, now + 1000)).toBe(false);
    });

    it('is true once the lock is older than the stale age', () => {
      expect(isLockStale(info, LOCK_STALE_MS, now + LOCK_STALE_MS + 1)).toBe(true);
    });
  });
});
