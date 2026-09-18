/**
 * Turns a running fiddle's stdout and stderr into console lines and runtime
 * errors. No Electron imports.
 *
 * - Node's inspector banner is dropped; its port is reported instead.
 * - With `ELECTRON_ENABLE_LOGGING`, Chromium writes renderer console messages
 *   to stderr: `[pid:…:ERROR:CONSOLE(4)] "Uncaught TypeError: …", source:
 *   file:///…/renderer.js (4)` (newer Chromium writes `CONSOLE:4]`). These
 *   become Renderer lines; a message can span several lines. Chromium's other
 *   log lines are dropped unless advanced logging is on.
 * - Main-process errors are an `…Error: message` line followed by stack frames.
 *   The first frame inside the run directory gives the location.
 * - Paths inside the run directory are mapped back to fiddle file names.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { OutputLine, RuntimeErrorValue, SourceLocation } from '../../shared/stores';

type ParsedLine = Omit<OutputLine, 'seq' | 'time'>;

interface ParserOptions {
  /** The run directory, plus its real path if that differs (macOS /var → /private/var). */
  roots: readonly string[];
  /** The fiddle's file names. Only these are mapped. */
  files: readonly string[];
  /** Keep Chromium's own log lines (the "advanced logging" setting). */
  chromiumLogs: boolean;
}

export interface ParseResult {
  lines: ParsedLine[];
  errors: RuntimeErrorValue[];
  /** Set when the inspector banner announced its port. */
  inspectorPort?: number;
}

const MAX_LINE = 10_000;
const MAX_CONTINUATION = 200;

const INSPECTOR_LISTENING = /^Debugger listening on ws:\/\/[^:\s]+:(\d+)\//;
const INSPECTOR_NOISE = [
  /^For help, see: https:\/\/nodejs\.org\//,
  /^Debugger attached\.?$/,
  /^Waiting for the debugger to disconnect\.*$/,
];
const LEVELS = '(INFO|WARNING|ERROR|FATAL|VERBOSE\\d*)';
const CONSOLE_START = new RegExp(
  `^\\[[^\\]]*?:${LEVELS}:CONSOLE(?:\\(\\d+\\)|:\\d+)\\] "`,
);
const CONSOLE_END = /", source: (.*?) \((\d+)\)$/;
const CHROMIUM_LOG = new RegExp(`^\\[\\d+:[^\\]]*?:${LEVELS}:[^\\]]*\\]`);
const ERROR_HEADER =
  /^(?:Uncaught Exception:\s*)?((?:[A-Z][\w$]*)?Error|[A-Z][\w$]*Exception)(?::\s?(.*))?$/;
const UNCAUGHT =
  /^Uncaught (?:\(in promise\) )?((?:[A-Z][\w$]*)?Error|[A-Z][\w$]*Exception)(?::\s?([\s\S]*))?$/;
const FRAME =
  /^\s+at (?:.*? \()?((?:file:\/\/)?(?:\/|[A-Za-z]:[\\/]).*?):(\d+):(\d+)\)?$/;
const FRAME_ANY = /^\s+at /;
const INLINE_FRAME = /\(?((?:file:\/\/)?(?:\/|[A-Za-z]:[\\/])[^\s()]*?):(\d+):(\d+)\)?/g;

/** A path or file:// URL inside one of `roots` → the fiddle file name, if it's one of `files`. */
export function mapToFiddleFile(
  ref: string,
  roots: readonly string[],
  files: readonly string[],
): string | undefined {
  let file = ref;
  if (file.startsWith('file://')) {
    try {
      file = fileURLToPath(file);
    } catch {
      return undefined;
    }
  }
  for (const root of roots) {
    const rel = path.relative(root, file);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel) && files.includes(rel))
      return rel;
  }
  return undefined;
}

function truncate(text: string): string {
  return text.length > MAX_LINE ? `${text.slice(0, MAX_LINE)}…` : text;
}

function processFor(file: string): RuntimeErrorValue['process'] {
  return /^preload\.[cm]?js$/.test(file) ? 'preload' : 'main';
}

interface PendingConsole {
  level: string;
  parts: string[];
}

interface PendingMainError {
  name: string;
  message: string;
  located: boolean;
}

export class OutputParser {
  readonly #options: ParserOptions;
  readonly #partial = { stdout: '', stderr: '' };
  #console: PendingConsole | undefined;
  #mainError: PendingMainError | undefined;

  constructor(options: ParserOptions) {
    this.#options = options;
  }

  /** Feeds a chunk. Complete lines are parsed; a trailing partial line waits. */
  push(stream: 'stdout' | 'stderr', chunk: string): ParseResult {
    const parts = (this.#partial[stream] + chunk).split(/\r?\n/);
    const partial = parts.pop() ?? '';
    // Only the first MAX_LINE characters of an unfinished line are ever shown,
    // so a huge line without a newline doesn't pile up or get re-scanned.
    this.#partial[stream] =
      partial.length > MAX_LINE ? partial.slice(0, MAX_LINE + 1) : partial;
    return this.#parseLines(stream, parts);
  }

  /** Parses whatever is left, e.g. when the process exits. */
  flush(): ParseResult {
    const result: ParseResult = { lines: [], errors: [] };
    for (const stream of ['stdout', 'stderr'] as const) {
      const rest = this.#partial[stream];
      this.#partial[stream] = '';
      if (rest) merge(result, this.#parseLines(stream, [rest]));
    }
    if (this.#console) merge(result, this.#finishConsole(undefined));
    return result;
  }

  #parseLines(stream: 'stdout' | 'stderr', raw: string[]): ParseResult {
    const result: ParseResult = { lines: [], errors: [] };
    for (const line of raw) merge(result, this.#parseLine(stream, line));
    return result;
  }

  #parseLine(stream: 'stdout' | 'stderr', line: string): ParseResult {
    const result: ParseResult = { lines: [], errors: [] };

    // A renderer console message that spans several lines.
    if (this.#console && stream === 'stderr') {
      const end = CONSOLE_END.exec(line);
      if (end || this.#console.parts.length >= MAX_CONTINUATION) {
        this.#console.parts.push(end ? line.slice(0, end.index) : line);
        return this.#finishConsole(
          end ? { source: end[1]!, line: Number(end[2]) } : undefined,
        );
      }
      this.#console.parts.push(line);
      return result;
    }

    const listening = INSPECTOR_LISTENING.exec(line);
    if (listening) {
      result.inspectorPort = Number(listening[1]);
      return result;
    }
    if (INSPECTOR_NOISE.some((re) => re.test(line))) return result;

    if (stream === 'stderr') {
      const start = CONSOLE_START.exec(line);
      if (start) {
        this.#mainError = undefined;
        const body = line.slice(start[0].length);
        this.#console = { level: start[1]!, parts: [] };
        const end = CONSOLE_END.exec(body);
        if (end) {
          this.#console.parts.push(body.slice(0, end.index));
          return this.#finishConsole({ source: end[1]!, line: Number(end[2]) });
        }
        this.#console.parts.push(body);
        return result;
      }
      if (CHROMIUM_LOG.test(line)) {
        if (this.#options.chromiumLogs) {
          result.lines.push({ process: 'main', kind: 'log', text: truncate(line) });
        }
        return result;
      }
    }

    return this.#parseMainLine(line);
  }

  /** Main-process output, watching for an error header and its stack frames. */
  #parseMainLine(line: string): ParseResult {
    const result: ParseResult = { lines: [], errors: [] };
    const pending = this.#mainError;

    if (pending && FRAME_ANY.test(line)) {
      const parsed: ParsedLine = { process: 'main', kind: 'error', text: truncate(line) };
      const frame = FRAME.exec(line);
      const file =
        frame && mapToFiddleFile(frame[1]!, this.#options.roots, this.#options.files);
      if (frame && file && !pending.located) {
        pending.located = true;
        const location = { file, line: Number(frame[2]), column: Number(frame[3]) };
        parsed.location = location;
        result.errors.push({
          ...location,
          process: processFor(file),
          name: pending.name,
          message: pending.message,
        });
      }
      result.lines.push(parsed);
      return result;
    }

    const header = ERROR_HEADER.exec(line);
    if (header) {
      this.#mainError = { name: header[1]!, message: header[2] ?? '', located: false };
      result.lines.push({ process: 'main', kind: 'error', text: truncate(line) });
      return result;
    }

    this.#mainError = undefined;
    if (line !== '')
      result.lines.push({ process: 'main', kind: 'log', text: truncate(line) });
    return result;
  }

  #finishConsole(end: { source: string; line: number } | undefined): ParseResult {
    const result: ParseResult = { lines: [], errors: [] };
    const pending = this.#console;
    this.#console = undefined;
    if (!pending) return result;

    const message = pending.parts.join('\n');
    // Newer Chromium logs every console message at INFO, uncaught errors included.
    const kind: ParsedLine['kind'] =
      pending.level === 'ERROR' || pending.level === 'FATAL' || UNCAUGHT.test(message)
        ? 'error'
        : pending.level === 'WARNING'
          ? 'warn'
          : 'log';
    const parsed: ParsedLine = { process: 'renderer', kind, text: truncate(message) };

    if (kind !== 'log') {
      const location = this.#locate(message, end);
      if (location) parsed.location = location;
      const uncaught = UNCAUGHT.exec(message);
      if (uncaught && location) {
        const firstLine = (uncaught[2] ?? '').split('\n')[0] ?? '';
        result.errors.push({
          ...location,
          process: processFor(location.file) === 'preload' ? 'preload' : 'renderer',
          name: uncaught[1]!,
          message: firstLine,
        });
      }
    }
    result.lines.push(parsed);
    return result;
  }

  /** A stack frame inside the run directory wins (it has a column); otherwise the `source`. */
  #locate(
    message: string,
    end: { source: string; line: number } | undefined,
  ): SourceLocation | undefined {
    const { roots, files } = this.#options;
    for (const match of message.matchAll(INLINE_FRAME)) {
      const file = mapToFiddleFile(match[1]!, roots, files);
      if (file) return { file, line: Number(match[2]), column: Number(match[3]) };
    }
    if (!end) return undefined;
    const file = mapToFiddleFile(end.source, roots, files);
    return file && end.line > 0 ? { file, line: end.line } : undefined;
  }
}

function merge(into: ParseResult, from: ParseResult): void {
  into.lines.push(...from.lines);
  into.errors.push(...from.errors);
  if (from.inspectorPort !== undefined) into.inspectorPort = from.inspectorPort;
}
