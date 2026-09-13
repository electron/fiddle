/**
 * The atomic JSON store every persisted file goes through (REQUIREMENTS §5).
 *
 *   const store = createJsonStore({ file, schema, defaults, version });
 *   store.get();                      // current value, always valid
 *   store.set((prev) => ({ ...prev, x: 1 }));
 *   await store.flush();              // resolves once it is on disk
 *
 * - Every file is JSON with a `schemaVersion`.
 * - Reads (synchronous, once, at creation) try the file, then `<file>.bak`,
 *   then the defaults. The `.bak` is only used when the file exists but can't
 *   be read or parsed: a file the user deleted means "start over".
 * - A file that isn't a JSON object is corrupt. It is moved to
 *   `<name>.corrupt-<timestamp>.json` and a notice is raised.
 * - Schema failures are per key: the invalid key is dropped in memory and
 *   logged. Schemas are loose, so unknown keys round-trip unchanged.
 * - Migrations are pure `vN → vN+1` functions. A file newer than `version` is
 *   opened read-only (writes are skipped) and a notice is raised.
 * - Writes go through one serialized queue per file that coalesces to the
 *   latest value: temp file, fsync, copy the current file to `.bak`, rename
 *   (retried on Windows), then fsync the directory on POSIX.
 *
 * No Electron imports. `flushAll()` is called on quit, `session-end` and
 * `powerMonitor` `shutdown` (see ./lifecycle.ts).
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { log } from '../log';

/** Anything with a zod-style object `shape`: each key is validated on its own. */
export interface ObjectSchema {
  shape: Record<string, { safeParse(value: unknown): { success: boolean; data?: unknown; error?: unknown } }>;
}

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export interface JsonStoreOptions<T> {
  /** Absolute path of the JSON file. */
  file: string;
  /** A loose object schema. Keys are validated one by one. */
  schema: ObjectSchema;
  /** Used for missing keys, and for everything when nothing can be read. */
  defaults: T;
  /** The `schemaVersion` this app writes. */
  version: number;
  /** `migrations[n]` turns a version-n file into version n+1. */
  migrations?: Record<number, Migration>;
  /** Test hook: called with each file content that is written. */
  onWrite?: (content: string) => void;
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
  /** True when the file is newer than this app: changes are kept in memory only. */
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

const stores = new Set<JsonStore<unknown>>();

/** Flushes every store. Main awaits this before quitting. */
export async function flushAll(): Promise<void> {
  await Promise.all([...stores].map((store) => store.flush()));
}

const VERSION_KEY = 'schemaVersion';

export function createJsonStore<T>(options: JsonStoreOptions<T>): JsonStore<T> {
  const { file, schema, version } = options;
  const loaded = load(options);
  let value = loaded.value;
  // Invalid keys stay on disk until the value gets a valid one.
  let invalidOnDisk = loaded.invalid;
  // The file text we last read or started writing.
  let lastText = loaded.text;

  let writing: Promise<void> | undefined;
  let dirty = false;

  const content = (): string => {
    const current = value as Record<string, unknown>;
    const kept = Object.fromEntries(
      Object.entries(invalidOnDisk).filter(([key]) => !(key in current)),
    );
    return `${JSON.stringify({ [VERSION_KEY]: version, ...kept, ...current }, null, 2)}\n`;
  };

  const drain = async (): Promise<void> => {
    // Let a synchronous burst of `set` calls land first: it becomes one write.
    await Promise.resolve();
    while (dirty) {
      dirty = false;
      const text = content();
      lastText = text;
      try {
        await writeAtomic(file, text);
        options.onWrite?.(text);
      } catch (error) {
        log.error('failed to write', file, error);
      }
    }
  };

  const schedule = (): void => {
    if (loaded.readOnly) return;
    dirty = true;
    writing ??= drain().finally(() => {
      writing = undefined;
    });
  };

  const store: JsonStore<T> = {
    get: () => value,
    set(next) {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      value = validate(schema, resolved as Record<string, unknown>, file) as T;
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
      invalidOnDisk = decoded.invalid;
      return true;
    },
    readOnly: loaded.readOnly,
    file,
  };
  stores.add(store as JsonStore<unknown>);
  return store;
}

interface Loaded<T> {
  value: T;
  invalid: Record<string, unknown>;
  readOnly: boolean;
  text?: string;
}

function load<T>(options: JsonStoreOptions<T>): Loaded<T> {
  const { file, defaults } = options;
  const empty: Loaded<T> = { value: defaults, invalid: {}, readOnly: false };
  // A missing main file means "defaults", not "restore the backup".
  if (!fs.existsSync(file)) return empty;
  const main = readCandidate(file);
  const candidate = main ?? readCandidate(`${file}.bak`);
  if (!candidate) return empty;
  return { ...decode(options, candidate.data), text: main?.text };
}

function decode<T>(
  { file, schema, defaults, version, migrations = {} }: JsonStoreOptions<T>,
  raw: Record<string, unknown>,
): Loaded<T> {
  const { [VERSION_KEY]: fileVersion, ...rest } = raw;
  let data: Record<string, unknown> = rest;
  let current = typeof fileVersion === 'number' && Number.isInteger(fileVersion) ? fileVersion : 1;
  let readOnly = false;

  if (current > version) {
    readOnly = true;
    notify({ kind: 'newer-version', file, version: current });
  }
  while (current < version) {
    const migrate = migrations[current];
    if (!migrate) {
      log.error(`no migration from v${current} for`, file);
      break;
    }
    data = migrate(data);
    current++;
  }

  const invalid: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(data)) {
    const field = schema.shape[key];
    if (field && !field.safeParse(entry).success) invalid[key] = entry;
  }
  const valid = validate(schema, data, file);
  return { value: { ...defaults, ...valid } as T, invalid, readOnly };
}

/** Drops (and logs) keys whose value fails their schema. Unknown keys are kept as they are. */
function validate(schema: ObjectSchema, data: Record<string, unknown>, file: string): Record<string, unknown> {
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

/**
 * Reads one candidate. Returns undefined if it is missing, unreadable or
 * corrupt; a corrupt file is moved aside first.
 */
function readCandidate(file: string): { data: Record<string, unknown>; text: string } | undefined {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') log.error('failed to read', file, error);
    return undefined;
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

export function corruptName(file: string, now = new Date()): string {
  const base = file.replace(/\.bak$/, '').replace(/\.json$/, '');
  const suffix = file.endsWith('.bak') ? '.bak' : '';
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `${base}${suffix}.corrupt-${stamp}.json`;
}

async function writeAtomic(file: string, text: string): Promise<void> {
  const dir = path.dirname(file);
  await fsp.mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    const handle = await fsp.open(temp, 'w');
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fsp.copyFile(file, `${file}.bak`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await renameWithRetry(temp, file);
  } catch (error) {
    await fsp.rm(temp, { force: true });
    throw error;
  }
  if (process.platform !== 'win32') await syncDir(dir);
}

async function syncDir(dir: string): Promise<void> {
  let handle: fsp.FileHandle | undefined;
  try {
    handle = await fsp.open(dir, 'r');
    await handle.sync();
  } catch {
    // Some file systems can't fsync a directory; the rename is still atomic.
  } finally {
    await handle?.close();
  }
}

const RETRYABLE = new Set(['EPERM', 'EACCES', 'EBUSY']);

/**
 * `rename`, retried with backoff for up to 10 seconds on EPERM, EACCES or
 * EBUSY on Windows, where virus scanners and indexers hold files briefly.
 */
export async function renameWithRetry(
  from: string,
  to: string,
  {
    platform = process.platform,
    rename = fsp.rename,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    budgetMs = 10_000,
  }: {
    platform?: NodeJS.Platform;
    rename?: (from: string, to: string) => Promise<void>;
    sleep?: (ms: number) => Promise<void>;
    budgetMs?: number;
  } = {},
): Promise<void> {
  let waited = 0;
  let delay = 20;
  for (;;) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (platform !== 'win32' || !RETRYABLE.has(code) || waited >= budgetMs) throw error;
      const wait = Math.min(delay, budgetMs - waited);
      await sleep(wait);
      waited += wait;
      delay = Math.min(delay * 2, 1000);
    }
  }
}
