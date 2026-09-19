import fs from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { log } from '../log';
import {
  corruptName,
  createJsonStore,
  flushAll,
  hasPendingWrites,
  onJsonStoreNotice,
  readJsonObjectSync,
  type JsonStoreNotice,
} from './json-store';

const schema = z.looseObject({ name: z.string(), count: z.number().int() });
interface Data {
  name: string;
  count: number;
  [key: string]: unknown;
}
const defaults: Data = { name: 'default', count: 0 };

let dir: string;
let file: string;
let notices: JsonStoreNotice[];

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'json-store-'));
  file = path.join(dir, 'data.json');
  notices = [];
  onJsonStoreNotice((notice) => notices.push(notice));
});

afterEach(async () => {
  onJsonStoreNotice(undefined);
  vi.clearAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const open = (extra: Partial<Parameters<typeof createJsonStore<Data>>[0]> = {}) =>
  createJsonStore<Data>({ file, schema, defaults, version: 2, ...extra });
const readJson = async (target = file): Promise<unknown> =>
  JSON.parse(await readFile(target, 'utf8'));

describe('reading', () => {
  it('uses the defaults when there is no file', () => {
    expect(open().get()).toEqual(defaults);
    expect(notices).toEqual([]);
  });

  it('writes JSON with a schemaVersion and reads it back', async () => {
    const store = open();
    store.set((prev) => ({ ...prev, count: 3 }));
    await store.flush();
    expect(await readJson()).toEqual({ schemaVersion: 2, name: 'default', count: 3 });
    expect(open().get()).toEqual({ name: 'default', count: 3 });
  });

  it('fills missing keys from the defaults', async () => {
    await writeFile(file, JSON.stringify({ schemaVersion: 2, count: 7 }));
    expect(open().get()).toEqual({ name: 'default', count: 7 });
  });

  it('keeps unknown keys through a round trip', async () => {
    await writeFile(
      file,
      JSON.stringify({ schemaVersion: 2, name: 'a', count: 1, extra: { x: 1 } }),
    );
    const store = open();
    expect(store.get()).toMatchObject({ extra: { x: 1 } });
    store.set((prev) => ({ ...prev, count: 2 }));
    await store.flush();
    expect(await readJson()).toEqual({
      schemaVersion: 2,
      name: 'a',
      count: 2,
      extra: { x: 1 },
    });
  });

  it('drops an invalid key in memory, logs it and leaves it on disk', async () => {
    const text = JSON.stringify({ schemaVersion: 2, name: 42, count: 5 });
    await writeFile(file, text);
    const store = createJsonStore<Partial<Data>>({
      file,
      schema,
      defaults: {},
      version: 2,
    });
    expect(store.get()).toEqual({ count: 5 });
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('"name"'),
      file,
      expect.anything(),
    );
    expect(await readFile(file, 'utf8')).toBe(text);

    store.set((prev) => ({ ...prev, count: 6 }));
    await store.flush();
    expect(await readJson()).toEqual({ schemaVersion: 2, name: 42, count: 6 });

    store.set((prev) => ({ ...prev, name: 'fixed' }));
    await store.flush();
    expect(await readJson()).toEqual({ schemaVersion: 2, name: 'fixed', count: 6 });
  });

  it('replaces an invalid value passed to set with its default', async () => {
    const store = open();
    store.set({ name: 'ok', count: 1.5 } as Data);
    expect(store.get()).toEqual({ name: 'ok', count: 0 });
    await store.flush();
  });
});

describe('corruption', () => {
  it('moves a corrupt file aside, tells the user and recovers from .bak, on this launch and the next', async () => {
    await writeFile(
      `${file}.bak`,
      JSON.stringify({ schemaVersion: 2, name: 'backup', count: 1 }),
    );
    await writeFile(file, '{ not json');
    const store = open();
    expect(store.get()).toEqual({ name: 'backup', count: 1 });
    expect(notices).toEqual([
      {
        kind: 'corrupt',
        file,
        movedTo: expect.stringMatching(/data\.corrupt-[\dTZ-]+\.json$/),
      },
    ]);
    await store.flush();
    const files = await readdir(dir);
    expect(files.filter((name) => /^data\.corrupt-.*\.json$/.test(name))).toHaveLength(1);
    expect(
      await readFile(
        path.join(
          dir,
          files.find((n) => n.includes('corrupt'))!,
        ),
        'utf8',
      ),
    ).toBe('{ not json');

    // The recovered values are back in the main file, so the next launch keeps them.
    expect(await readJson()).toEqual({ schemaVersion: 2, name: 'backup', count: 1 });
    notices = [];
    expect(open().get()).toEqual({ name: 'backup', count: 1 });
    expect(notices).toEqual([]);
  });

  it('keeps a file it cannot read and does not write over it', async () => {
    await writeFile(
      `${file}.bak`,
      JSON.stringify({ schemaVersion: 2, name: 'older', count: 1 }),
    );
    // Reading a folder fails with an error other than "not found".
    await mkdir(file);
    const store = open();
    expect(store.readOnly).toBe(true);
    expect(store.get()).toEqual({ name: 'older', count: 1 });
    expect(notices).toEqual([]);

    store.set((prev) => ({ ...prev, count: 2 }));
    await store.flush();
    expect((await stat(file)).isDirectory()).toBe(true);
    expect(await readJson(`${file}.bak`)).toMatchObject({ name: 'older', count: 1 });
  });

  it('retries a read that fails for a moment, instead of going read-only', async () => {
    await writeFile(file, JSON.stringify({ schemaVersion: 2, name: 'disk', count: 1 }));
    const real = fs.readFileSync;
    let busy = 2;
    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(((...args) => {
      if (args[0] === file && busy-- > 0)
        throw Object.assign(new Error('busy'), { code: 'EBUSY' });
      return Reflect.apply(real, fs, args);
    }) as typeof fs.readFileSync);
    try {
      const store = open();
      expect(store.readOnly).toBe(false);
      expect(store.get()).toEqual({ name: 'disk', count: 1 });
    } finally {
      spy.mockRestore();
    }
  });

  it('leaves read-only once a reload can read the file', async () => {
    await mkdir(file);
    const store = open();
    expect(store.readOnly).toBe(true);
    await rm(file, { recursive: true });
    await writeFile(file, JSON.stringify({ schemaVersion: 2, name: 'disk', count: 5 }));
    expect(store.reload()).toBe(true);
    expect(store.readOnly).toBe(false);
    expect(store.get()).toEqual({ name: 'disk', count: 5 });

    store.set((prev) => ({ ...prev, count: 6 }));
    await store.flush();
    expect(await readJson()).toMatchObject({ count: 6 });
  });

  it('treats JSON that is not an object as corrupt', async () => {
    await writeFile(file, '[1, 2]');
    expect(open().get()).toEqual(defaults);
    expect(notices.map((n) => n.kind)).toEqual(['corrupt']);
  });

  it('falls back to the defaults when the file and .bak are both corrupt', async () => {
    await writeFile(file, 'nope');
    await writeFile(`${file}.bak`, 'also nope');
    expect(open().get()).toEqual(defaults);
    expect(notices.map((n) => n.kind)).toEqual(['corrupt', 'corrupt']);
  });

  it('does not restore .bak when the file was deleted', async () => {
    await writeFile(
      `${file}.bak`,
      JSON.stringify({ schemaVersion: 2, name: 'backup', count: 1 }),
    );
    const store = open();
    expect(store.get()).toEqual(defaults);
    await store.flush();
    expect(await readdir(dir)).toEqual(['data.json.bak']);
  });

  it('copies the previous file to .bak before each write', async () => {
    const store = open();
    store.set((prev) => ({ ...prev, count: 1 }));
    await store.flush();
    store.set((prev) => ({ ...prev, count: 2 }));
    await store.flush();
    expect(await readJson(`${file}.bak`)).toMatchObject({ count: 1 });
    expect(await readJson()).toMatchObject({ count: 2 });
  });

  it('delivers notices raised before a listener is set', async () => {
    onJsonStoreNotice(undefined);
    await writeFile(file, 'nope');
    open();
    const late: JsonStoreNotice[] = [];
    onJsonStoreNotice((notice) => late.push(notice));
    expect(late.map((n) => n.kind)).toEqual(['corrupt']);
  });
});

describe('versions', () => {
  it('opens a newer file read-only and tells the user', async () => {
    const text = JSON.stringify({ schemaVersion: 3, name: 'future', count: 9 });
    await writeFile(file, text);
    const store = open();
    expect(store.readOnly).toBe(true);
    expect(store.get()).toEqual({ name: 'future', count: 9 });
    expect(notices).toEqual([{ kind: 'newer-version', file, version: 3 }]);

    store.set((prev) => ({ ...prev, count: 1 }));
    await store.flush();
    expect(store.get().count).toBe(1);
    expect(await readFile(file, 'utf8')).toBe(text);
  });

  it('runs migrations in order, treating a file without schemaVersion as v1', async () => {
    await writeFile(file, JSON.stringify({ title: 'old', count: 2 }));
    const store = open({
      version: 3,
      migrations: {
        1: ({ title, ...rest }) => ({ ...rest, name: String(title) }),
        2: (data) => ({ ...data, count: Number(data.count) * 10 }),
      },
    });
    expect(store.get()).toEqual({ name: 'old', count: 20 });
    store.set((prev) => prev);
    await store.flush();
    expect(await readJson()).toEqual({ schemaVersion: 3, name: 'old', count: 20 });
  });
});

describe('writing', () => {
  it('coalesces a burst of writes to the latest value', async () => {
    const writes: string[] = [];
    const store = open({ onWrite: (text) => writes.push(text) });
    for (let i = 1; i <= 50; i++) store.set((prev) => ({ ...prev, count: i }));
    await store.flush();
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]!)).toMatchObject({ count: 50 });
    expect(await readdir(dir)).toEqual(['data.json']);
  });

  it('writes once more when values change during a write', async () => {
    const writes: string[] = [];
    const store = open({ onWrite: (text) => writes.push(text) });
    store.set((prev) => ({ ...prev, count: 1 }));
    await Promise.resolve();
    await Promise.resolve();
    for (let i = 2; i <= 20; i++) store.set((prev) => ({ ...prev, count: i }));
    await store.flush();
    expect(writes.length).toBeLessThanOrEqual(2);
    expect(JSON.parse(writes.at(-1)!)).toMatchObject({ count: 20 });
    expect(await readJson()).toMatchObject({ count: 20 });
  });

  it('flushAll waits for every store', async () => {
    const other = path.join(dir, 'other.json');
    const a = open();
    const b = createJsonStore<Data>({ file: other, schema, defaults, version: 1 });
    a.set((prev) => ({ ...prev, count: 1 }));
    b.set((prev) => ({ ...prev, count: 2 }));
    await flushAll();
    expect(await readJson()).toMatchObject({ count: 1 });
    expect(await readJson(other)).toMatchObject({ count: 2, schemaVersion: 1 });
  });

  it("lets go of a store once it has written, so a closed window's draft can be collected", async () => {
    const store = open();
    store.set((prev) => ({ ...prev, count: 1 }));
    expect(hasPendingWrites()).toBe(true);
    await store.flush();
    expect(hasPendingWrites()).toBe(false);

    const flush = vi.spyOn(store, 'flush');
    await flushAll();
    expect(flush).not.toHaveBeenCalled();
  });

  it('creates the directory if needed', async () => {
    const nested = path.join(dir, 'a', 'b', 'data.json');
    const store = createJsonStore<Data>({ file: nested, schema, defaults, version: 1 });
    store.set((prev) => ({ ...prev, count: 4 }));
    await store.flush();
    expect(await readJson(nested)).toMatchObject({ count: 4 });
  });
});

describe('readJsonObjectSync', () => {
  it('reads the file, falls back to .bak when it is unusable, and moves nothing', async () => {
    expect(readJsonObjectSync(file)).toBeUndefined();

    await writeFile(`${file}.bak`, '{"count":1}');
    expect(readJsonObjectSync(file)).toBeUndefined();

    await writeFile(file, '{"count":2}');
    expect(readJsonObjectSync(file)).toEqual({ count: 2 });

    await writeFile(file, '{ nope');
    expect(readJsonObjectSync(file)).toEqual({ count: 1 });
    expect(await readdir(dir)).toEqual(['data.json', 'data.json.bak']);
  });
});

it('names corrupt files with a timestamp', () => {
  const now = new Date('2026-01-02T03:04:05.678Z');
  expect(corruptName('/x/settings.json', now)).toBe(
    '/x/settings.corrupt-2026-01-02T03-04-05-678Z.json',
  );
  expect(corruptName('/x/settings.json.bak', now)).toBe(
    '/x/settings.bak.corrupt-2026-01-02T03-04-05-678Z.json',
  );
});
