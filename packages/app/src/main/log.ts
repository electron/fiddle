/**
 * No Electron imports, so modules that log still run under plain Node tests.
 * Entries logged before `initLogFile()` are buffered and written once it runs.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { redactSecrets, scrubValue } from './crash/scrub';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogSource = 'main' | 'renderer';

const PREFIX = '[fiddle]';
const LOG_FILE = 'main.log';
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_LOG_FILES = 3;
/** Entries kept in memory while the log file isn't open yet. */
const MAX_EARLY_LINES = 1000;

const home = os.homedir();

const redact = (text: string) => redactSecrets(text, home);

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
    msg: redact(message),
    ...(details.length
      ? { details: details.map((detail) => scrubValue(detail, redact)) }
      : {}),
  });
}

/** Appends lines to `<dir>/main.log`, rotating it once a batch would pass `maxBytes`. Writes are serialized and batched. */
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

  /** Writes the pending lines now, without rotating, for a process that may not run another tick. */
  flushSync(): void {
    const chunk = this.#pending.splice(0).join('');
    if (!chunk) return;
    try {
      fs.appendFileSync(this.file(0), chunk, { mode: 0o600 });
      this.#size += Buffer.byteLength(chunk);
    } catch (error) {
      console.error(PREFIX, 'failed to write the log file', error);
    }
  }

  async #drain(): Promise<void> {
    // Let a synchronous burst of entries land first: it becomes one append (and may pass `maxBytes` by a batch).
    await Promise.resolve();
    while (this.#pending.length) {
      const chunk = this.#pending.splice(0).join('');
      const bytes = Buffer.byteLength(chunk);
      if (this.#size > 0 && this.#size + bytes > this.#maxBytes) await this.#rotate();
      await this.#append(chunk, bytes);
    }
  }

  async #append(chunk: string, bytes: number): Promise<void> {
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

/**
 * Logs uncaught exceptions and unhandled rejections. The monitor only observes, so Electron's error box
 * (or Sentry) still runs; the box blocks the thread, so the line is written synchronously first.
 * Electron runs Node with unhandled rejections in `warn` mode: no exception is raised, so they need
 * a listener of their own.
 */
export function logProcessErrors(): void {
  process.on('uncaughtExceptionMonitor', (error) => {
    log.error('uncaught exception', error);
    sink?.flushSync();
  });
  process.on('unhandledRejection', (reason) => log.error('unhandled rejection', reason));
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
