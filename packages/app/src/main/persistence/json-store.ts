/**
 * Every persisted file is a JSON object with a `schemaVersion`. A key that fails
 * its schema is dropped (and logged); the next write drops it from the file too. No Electron imports.
 */
import fs from 'node:fs';

import { writeAtomic } from '@electron/fiddle-core';

import { log } from '../log';

/** Anything with a zod-style object `shape`: each key is validated on its own. */
interface ObjectSchema {
  shape: Record<
    string,
    { safeParse(value: unknown): { success: boolean; data?: unknown; error?: unknown } }
  >;
}

interface JsonStoreOptions<T> {
  file: string;
  /** A loose object schema. Keys are validated one by one. */
  schema: ObjectSchema;
  /** Used for missing keys, and for everything when nothing can be read. */
  defaults: T;
  /** The `schemaVersion` this app writes. A file with a higher one is read but never written back. */
  version: number;
}

export interface JsonStore<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  /** Resolves once everything set so far is on disk (or has failed to write). */
  flush(): Promise<void>;
  /**
   * Re-reads the file after an outside edit. Returns true if the value
   * changed. Our own writes, unparsable text (an edit in progress) and
   * reads during a write are ignored.
   */
  reload(): boolean;
  /** True when the file is newer than this app or couldn't be read: changes are kept in memory only. A `reload()` that reads the file clears it. */
  readonly readOnly: boolean;
  readonly file: string;
}

export type JsonStoreNotice =
  | { kind: 'corrupt'; file: string; movedTo: string }
  | { kind: 'newer-version'; file: string; version: number };

type NoticeListener = (notice: JsonStoreNotice) => void;

let noticeListener: NoticeListener | undefined;
const queuedNotices: JsonStoreNotice[] = [];

/**
 * Sets the one callback that turns store notices into user-visible messages.
 * Notices raised before it is set are delivered when it is.
 */
export function onJsonStoreNotice(listener: NoticeListener | undefined): void {
  noticeListener = listener;
  if (!listener) return;
  for (const notice of queuedNotices.splice(0)) listener(notice);
}

function notify(notice: JsonStoreNotice): void {
  log.warn('json store notice', notice);
  if (noticeListener) noticeListener(notice);
  else queuedNotices.push(notice);
}

/** The stores with a write in flight; a store leaves the set when it is idle, so closed windows' drafts can be collected. */
const writingStores = new Set<JsonStore<unknown>>();

/** Flushes every store. Main awaits this before quitting. */
export async function flushAll(): Promise<void> {
  await Promise.all([...writingStores].map((store) => store.flush()));
}

/** True while any store has a value that isn't on disk yet. */
export function hasPendingWrites(): boolean {
  return writingStores.size > 0;
}

const VERSION_KEY = 'schemaVersion';

export function createJsonStore<T>(options: JsonStoreOptions<T>): JsonStore<T> {
  const { file, schema, version } = options;
  const loaded = load(options);
  let value = loaded.value;
  let readOnly = loaded.readOnly;
  // The file text we last read or started writing.
  let lastText = loaded.text;

  let writing: Promise<void> | undefined;
  let dirty = false;

  const drain = async (): Promise<void> => {
    // Let a synchronous burst of `set` calls land first: it becomes one write.
    await Promise.resolve();
    while (dirty) {
      dirty = false;
      const text = `${JSON.stringify({ [VERSION_KEY]: version, ...value }, null, 2)}\n`;
      lastText = text;
      try {
        await writeAtomic(file, text, { backup: true });
      } catch (error) {
        log.error('failed to write', file, error);
      }
    }
  };

  const schedule = (): void => {
    if (readOnly) return;
    dirty = true;
    if (writing) return;
    writingStores.add(store as JsonStore<unknown>);
    writing = drain().finally(() => {
      writing = undefined;
      writingStores.delete(store as JsonStore<unknown>);
    });
  };

  const store: JsonStore<T> = {
    get: () => value,
    set(next) {
      const resolved =
        typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      value = {
        ...options.defaults,
        ...validate(schema, resolved as Record<string, unknown>, file),
      } as T;
      schedule();
    },
    async flush() {
      while (writing) await writing;
    },
    reload() {
      if (writing) return false;
      let text: string;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch {
        return false;
      }
      if (text === lastText) return false;
      const raw = parseObject(text);
      if (!raw) return false;
      lastText = text;
      const decoded = decode(options, raw);
      value = decoded.value;
      readOnly = decoded.readOnly;
      return true;
    },
    get readOnly() {
      return readOnly;
    },
    file,
  };
  // Nothing else writes the main file back after a recovery, and the next launch
  // would find no file and start from the defaults.
  if (loaded.recovered) schedule();
  return store;
}

interface Loaded<T> {
  value: T;
  readOnly: boolean;
  text?: string;
  /** The values came from `.bak` because the main file was corrupt. */
  recovered?: boolean;
}

function load<T>(options: JsonStoreOptions<T>): Loaded<T> {
  const { file, defaults } = options;
  const empty: Loaded<T> = { value: defaults, readOnly: false };
  // A missing main file means "defaults", not "restore the backup".
  if (!fs.existsSync(file)) return empty;
  let main: Candidate | undefined;
  try {
    main = readCandidate(file);
  } catch (error) {
    // Unreadable is not corrupt (a virus scanner may hold the file): show the
    // backup, but never write over a file that may be the newer one.
    log.error('failed to read', file, error);
    const backup = readBackup(file);
    return { ...(backup ? decode(options, backup.data) : empty), readOnly: true };
  }
  if (main) return { ...decode(options, main.data), text: main.text };
  const backup = readBackup(file);
  return backup ? { ...decode(options, backup.data), recovered: true } : empty;
}

function readBackup(file: string): Candidate | undefined {
  try {
    return readCandidate(`${file}.bak`);
  } catch (error) {
    log.error('failed to read', `${file}.bak`, error);
    return undefined;
  }
}

function decode<T>(
  { file, schema, defaults, version }: JsonStoreOptions<T>,
  raw: Record<string, unknown>,
): Loaded<T> {
  const { [VERSION_KEY]: fileVersion, ...data } = raw;
  // A file without a version is v1. An older file reads as it is until a version needs a migration.
  const readOnly = typeof fileVersion === 'number' && fileVersion > version;
  if (readOnly) notify({ kind: 'newer-version', file, version: fileVersion });
  return { value: { ...defaults, ...validate(schema, data, file) } as T, readOnly };
}

/** Drops (and logs) keys whose value fails their schema. Unknown keys are kept as they are. */
function validate(
  schema: ObjectSchema,
  data: Record<string, unknown>,
  file: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(data)) {
    const field = schema.shape[key];
    if (!field) {
      out[key] = entry;
      continue;
    }
    const result = field.safeParse(entry);
    if (result.success) out[key] = result.data;
    else log.warn(`dropping invalid "${key}" in`, file, result.error);
  }
  return out;
}

type Candidate = { data: Record<string, unknown>; text: string };

/** A virus scanner or indexer can hold a file for a moment; a short wait is cheaper than a read-only session. */
const TRANSIENT_READ_ERRORS = new Set(['EBUSY', 'EACCES', 'EPERM']);
const READ_RETRIES = 3;
const READ_RETRY_MS = 30;

function readFileRetrying(file: string): string {
  for (let attempt = 0; ; attempt++) {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (attempt >= READ_RETRIES || !TRANSIENT_READ_ERRORS.has(code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, READ_RETRY_MS);
    }
  }
}

/**
 * Reads one candidate. Returns undefined if it is missing or corrupt (a corrupt
 * file is moved aside first) and throws if it can't be read.
 */
function readCandidate(file: string): Candidate | undefined {
  let text: string;
  try {
    text = readFileRetrying(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const data = parseObject(text);
  if (data) return { data, text };
  const movedTo = corruptName(file);
  try {
    fs.renameSync(file, movedTo);
  } catch (error) {
    log.error('failed to move a corrupt file aside', file, error);
  }
  notify({ kind: 'corrupt', file, movedTo });
  return undefined;
}

/** The JSON object in `text`, or undefined if it isn't one (the file is corrupt). */
function parseObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Not JSON.
  }
  return undefined;
}

/**
 * The JSON object in `file`, or in its `.bak` when the file can't be used, for
 * values needed before the stores exist. Unlike a store it moves nothing aside.
 */
export function readJsonObjectSync(file: string): Record<string, unknown> | undefined {
  if (!fs.existsSync(file)) return undefined;
  for (const candidate of [file, `${file}.bak`]) {
    try {
      const data = parseObject(fs.readFileSync(candidate, 'utf8'));
      if (data) return data;
    } catch {
      // Missing or unreadable: try the backup.
    }
  }
  return undefined;
}

export function corruptName(file: string, now = new Date()): string {
  const base = file.replace(/\.bak$/, '').replace(/\.json$/, '');
  const suffix = file.endsWith('.bak') ? '.bak' : '';
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `${base}${suffix}.corrupt-${stamp}.json`;
}
