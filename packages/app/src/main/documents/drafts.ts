import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { VersionRefSchema } from '../../fiddle/fiddle';
import { createJsonStore, type JsonStore } from '../persistence/json-store';

const DRAFT_DEBOUNCE_MS = 500;
const DRAFT_MAX_WAIT_MS = 5000;

const fileMap = z.record(z.string(), z.string());

const originSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local') }),
  z.object({ kind: z.literal('example') }),
  z.object({
    kind: z.literal('gist'),
    owner: z.string(),
    id: z.string(),
    sha: z.string(),
  }),
  z.object({ kind: z.literal('electron'), tag: z.string(), path: z.string() }),
]);

/** A fiddle as persisted in drafts and sessions. */
export const storedFiddleSchema = z.object({
  files: fileMap,
  hidden: z.array(z.string()),
  version: VersionRefSchema,
  modules: z.record(z.string(), z.string()),
  origin: originSchema,
  source: z.object({
    localPath: z.string().optional(),
    gistId: z.string().optional(),
    gistRevision: z.string().optional(),
  }),
  templateName: z.string().optional(),
});
export type StoredFiddle = z.infer<typeof storedFiddleSchema>;

const draftSchema = z.looseObject({
  windowId: z.string(),
  savedAt: z.string(),
  name: z.string(),
  fiddle: storedFiddleSchema.nullable(),
  baseline: fileMap,
  baselineModules: z.record(z.string(), z.string()).optional(),
  activeFile: z.string().nullable(),
  gistOwner: z.string().optional(),
});
export type Draft = z.infer<typeof draftSchema>;

const EMPTY_DRAFT: Draft = {
  windowId: '',
  savedAt: '',
  name: '',
  fiddle: null,
  baseline: {},
  activeFile: null,
};

/** A window ID is a draft's file name, so it must not be able to leave the drafts folder. */
export const WINDOW_ID_RE = /^[0-9a-f-]{36}$/i;
const DRAFT_FILE_RE = /^([0-9a-f-]{36})\.json$/i;

interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
  now: () => Date.now(),
};

/**
 * Calls `write(id)` 500 ms after the last `touch(id)`, but never later than
 * 5 s after the first untouched edit, so continuous typing still saves.
 */
export class DraftScheduler {
  readonly #pending = new Map<string, { since: number; handle: unknown }>();
  readonly #write: (id: string) => void;
  readonly #timers: Timers;

  constructor(write: (id: string) => void, timers: Timers = realTimers) {
    this.#write = write;
    this.#timers = timers;
  }

  touch(id: string): void {
    const now = this.#timers.now();
    const entry = this.#pending.get(id);
    const since = entry?.since ?? now;
    if (entry) this.#timers.clearTimeout(entry.handle);
    const wait = Math.max(
      0,
      Math.min(DRAFT_DEBOUNCE_MS, since + DRAFT_MAX_WAIT_MS - now),
    );
    this.#pending.set(id, {
      since,
      handle: this.#timers.setTimeout(() => this.#fire(id), wait),
    });
  }

  cancel(id: string): void {
    const entry = this.#pending.get(id);
    if (entry) this.#timers.clearTimeout(entry.handle);
    this.#pending.delete(id);
  }

  /** Writes every pending draft now (on quit). */
  flushAll(): void {
    for (const id of [...this.#pending.keys()]) {
      this.cancel(id);
      this.#write(id);
    }
  }

  isPending(id: string): boolean {
    return this.#pending.has(id);
  }

  #fire(id: string): void {
    this.#pending.delete(id);
    this.#write(id);
  }
}

export class DraftStore {
  readonly #dir: string;
  readonly #stores = new Map<string, JsonStore<Draft>>();

  constructor(dir: string) {
    this.#dir = dir;
  }

  #file(id: string): string {
    if (!WINDOW_ID_RE.test(id)) throw new Error(`Invalid draft id: ${id}`);
    return path.join(this.#dir, `${id}.json`);
  }

  #store(id: string): JsonStore<Draft> {
    let store = this.#stores.get(id);
    if (!store) {
      store = createJsonStore<Draft>({
        file: this.#file(id),
        schema: draftSchema,
        defaults: EMPTY_DRAFT,
        version: 1,
      });
      this.#stores.set(id, store);
    }
    return store;
  }

  write(draft: Draft): void {
    this.#store(draft.windowId).set(draft);
  }

  read(id: string): Draft | undefined {
    if (!this.#stores.has(id) && !fs.existsSync(this.#file(id))) return undefined;
    const draft = this.#store(id).get();
    return draft.windowId === id && draft.fiddle ? draft : undefined;
  }

  async remove(id: string): Promise<void> {
    const store = this.#stores.get(id);
    this.#stores.delete(id);
    await store?.flush();
    const file = this.#file(id);
    await Promise.all([
      fsp.rm(file, { force: true }),
      fsp.rm(`${file}.bak`, { force: true }),
    ]);
  }

  /** Renames a draft that can't be read, so it isn't deleted with its window but stays for manual recovery. */
  async setAside(id: string): Promise<boolean> {
    this.#stores.delete(id);
    try {
      await fsp.rename(
        this.#file(id),
        path.join(this.#dir, `${id}.unreadable-${Date.now()}.json`),
      );
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    let names: string[];
    try {
      names = await fsp.readdir(this.#dir);
    } catch {
      return [];
    }
    return names.flatMap((name) => {
      const match = DRAFT_FILE_RE.exec(name);
      return match ? [match[1]!] : [];
    });
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#stores.values()].map((store) => store.flush()));
  }
}
