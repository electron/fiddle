/**
 * No Electron imports, so modules that log still run under plain Node tests.
 * Entries logged before `initLogFile()` are buffered and written once it runs.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isSecretKey, REDACTED, redactSecrets } from './crash/scrub';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogSource = 'main' | 'renderer';

const PREFIX = '[fiddle]';
const LOG_FILE = 'main.log';
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_LOG_FILES = 3;
/** Entries kept in memory while the log file isn't open yet. */
const MAX_EARLY_LINES = 1000;

const home = os.homedir();

/** Makes a detail JSON-safe and redacted. Cycles are cut; an object shared without cycling prints in full each time. */
function toJson(value: unknown, seen: Set<object>, depth: number): unknown {
  if (typeof value === 'string') return redactSecrets(value, home);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return String(value);
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value) || depth > 8) return '[circular]';
  seen.add(value);
  const json = objectToJson(value, seen, depth);
  seen.delete(value);
  return json;
}

function objectToJson(value: object, seen: Set<object>, depth: number): unknown {
  if (value instanceof Error) {
    const { code, details, cause } = value as {
      code?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    const extra = (name: string, item: unknown) =>
      item === undefined ? {} : { [name]: toJson(item, seen, depth + 1) };
    return {
      name: value.name,
      message: redactSecrets(value.message, home),
      ...(value.stack === undefined ? {} : { stack: redactSecrets(value.stack, home) }),
      ...extra('code', code),
      ...extra('details', details),
      ...extra('cause', cause),
    };
  }
  if (Array.isArray(value)) return value.map((item) => toJson(item, seen, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[redactSecrets(key, home)] =
      typeof item === 'string' && isSecretKey(key)
        ? REDACTED
        : toJson(item, seen, depth + 1);
  }
  return out;
}

/** One JSON-lines entry, redacted. */
export function formatEntry(
  level: LogLevel,
  message: string,
  details: readonly unknown[],
  source: LogSource = 'main',
  now: Date = new Date(),
): string {
  return JSON.stringify({
    t: now.toISOString(),
    level,
    process: source,
    msg: redactSecrets(message, home),
    ...(details.length
      ? { details: details.map((detail) => toJson(detail, new Set(), 0)) }
      : {}),
  });
}

/** Appends lines to `<dir>/main.log`, rotating it at `maxBytes`. Writes are serialized and batched. */
export class LogFile {
  readonly dir: string;
  readonly #maxBytes: number;
  readonly #maxFiles: number;
  #size: number;
  #pending: string[] = [];
  #writing: Promise<void> | undefined;

  constructor(dir: string, { maxBytes = MAX_LOG_BYTES, maxFiles = MAX_LOG_FILES } = {}) {
    this.dir = dir;
    this.#maxBytes = maxBytes;
    this.#maxFiles = maxFiles;
    fs.mkdirSync(dir, { recursive: true });
    try {
      this.#size = fs.statSync(this.file(0)).size;
    } catch {
      this.#size = 0;
    }
  }

  /** `main.log`, `main.1.log`, `main.2.log`, … */
  file(index: number): string {
    return path.join(
      this.dir,
      index === 0 ? LOG_FILE : LOG_FILE.replace(/\.log$/, `.${index}.log`),
    );
  }

  write(line: string): void {
    this.#pending.push(`${line}\n`);
    this.#writing ??= this.#drain().finally(() => {
      this.#writing = undefined;
    });
  }

  /** Resolves once every line written so far is on disk (or failed to write). */
  async flush(): Promise<void> {
    while (this.#writing) await this.#writing;
  }

  async #drain(): Promise<void> {
    // Let a synchronous burst of entries land first: it becomes one append.
    await Promise.resolve();
    while (this.#pending.length) {
      let chunk = '';
      let chunkBytes = 0;
      for (const line of this.#pending.splice(0)) {
        const bytes = Buffer.byteLength(line);
        if (
          this.#size + chunkBytes > 0 &&
          this.#size + chunkBytes + bytes > this.#maxBytes
        ) {
          await this.#append(chunk, chunkBytes);
          await this.#rotate();
          chunk = '';
          chunkBytes = 0;
        }
        chunk += line;
        chunkBytes += bytes;
      }
      await this.#append(chunk, chunkBytes);
    }
  }

  async #append(chunk: string, bytes: number): Promise<void> {
    if (!chunk) return;
    try {
      await fsp.appendFile(this.file(0), chunk, { mode: 0o600 });
      this.#size += bytes;
    } catch (error) {
      console.error(PREFIX, 'failed to write the log file', error);
    }
  }

  async #rotate(): Promise<void> {
    try {
      await fsp.rm(this.file(this.#maxFiles - 1), { force: true });
      for (let index = this.#maxFiles - 2; index >= 0; index--) {
        await fsp
          .rename(this.file(index), this.file(index + 1))
          .catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          });
      }
    } catch (error) {
      console.error(PREFIX, 'failed to rotate the log file', error);
    }
    this.#size = 0;
  }
}

let sink: LogFile | undefined;
let early: string[] = [];

/** Opens `<dir>/main.log` and writes what was logged so far. Call once, after `userData` is final. */
export function initLogFile(dir: string): void {
  sink = new LogFile(dir);
  for (const line of early) sink.write(line);
  early = [];
}

/** Resolves once everything logged so far is on disk. Call before `app.exit()`, which doesn't wait. */
export async function flushLog(): Promise<void> {
  await sink?.flush();
}

/** The logs folder, once `initLogFile()` has run. */
export function logsDir(): string | undefined {
  return sink?.dir;
}

function write(
  level: LogLevel,
  message: string,
  details: unknown[],
  source: LogSource,
): void {
  const method = level === 'debug' || level === 'info' ? 'log' : level;
  console[method](
    source === 'main' ? PREFIX : `${PREFIX} [renderer]`,
    message,
    ...details,
  );
  const line = formatEntry(level, message, details, source);
  if (sink) sink.write(line);
  else if (early.length < MAX_EARLY_LINES) early.push(line);
}

export const log = {
  debug: (message: string, ...details: unknown[]) =>
    write('debug', message, details, 'main'),
  info: (message: string, ...details: unknown[]) =>
    write('info', message, details, 'main'),
  warn: (message: string, ...details: unknown[]) =>
    write('warn', message, details, 'main'),
  error: (message: string, ...details: unknown[]) =>
    write('error', message, details, 'main'),
  /** An entry forwarded from a renderer through `AppPlatform.Log`. */
  fromRenderer: (level: LogLevel, message: string) =>
    write(level, message, [], 'renderer'),
};
