import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DraftScheduler, DraftStore, type Draft } from './drafts';

describe('DraftScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function scheduler() {
    const writes: number[] = [];
    const s = new DraftScheduler(() => writes.push(Date.now()));
    return { s, writes };
  }

  it('writes 500 ms after the last edit', () => {
    const { s, writes } = scheduler();
    const start = Date.now();
    s.touch('w');
    vi.advanceTimersByTime(300);
    s.touch('w');
    vi.advanceTimersByTime(499);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(writes).toEqual([start + 800]);
  });

  it('writes at least every 5 seconds during continuous editing', () => {
    const { s, writes } = scheduler();
    const start = Date.now();
    for (let t = 0; t < 12_000; t += 100) {
      s.touch('w');
      vi.advanceTimersByTime(100);
    }
    expect(writes.length).toBe(2);
    expect(writes[0]! - start).toBe(5000);
    expect(writes[1]! - writes[0]!).toBeLessThanOrEqual(5100);
  });

  it('cancels and flushes', () => {
    const { s, writes } = scheduler();
    s.touch('a');
    s.cancel('a');
    vi.advanceTimersByTime(10_000);
    expect(writes).toEqual([]);
    s.touch('b');
    expect(s.isPending('b')).toBe(true);
    s.flushAll();
    expect(writes.length).toBe(1);
    expect(s.isPending('b')).toBe(false);
  });
});

describe('DraftStore', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'drafts-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const id = '0b9f3c9e-1d6f-4a6b-9b8e-2f7c1a2b3c4d';
  const draft: Draft = {
    windowId: id,
    savedAt: '2026-09-13T00:00:00.000Z',
    name: 'sleepy-golden-otter',
    fiddle: {
      files: { 'main.js': 'edited' },
      hidden: [],
      version: { kind: 'release', version: '30.0.0' },
      modules: {},
      origin: { kind: 'local' },
      source: {},
      templateName: 'template',
    },
    baseline: { 'main.js': 'original' },
    activeFile: 'main.js',
  };

  it('writes, lists, reads and deletes drafts', async () => {
    const store = new DraftStore(dir);
    store.write(draft);
    await store.flush();
    expect(await store.list()).toEqual([id]);

    const fresh = new DraftStore(dir);
    expect(fresh.read(id)).toMatchObject({ name: draft.name, baseline: draft.baseline });
    await fresh.remove(id);
    expect(await store.list()).toEqual([]);
    expect((await readdir(dir)).filter((n) => n.startsWith(id))).toEqual([]);
  });

  it('refuses IDs that could escape the folder', () => {
    const store = new DraftStore(dir);
    expect(() => store.read('../settings')).toThrow();
  });
});
