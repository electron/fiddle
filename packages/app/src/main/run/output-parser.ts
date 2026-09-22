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
  /** Set when the inspector banner announced its address: `port/id`, the id being what authorises an attach. */
  inspectorAddress?: string;
}

const MAX_LINE = 10_000;
const MAX_CONTINUATION = 200;

const INSPECTOR_LISTENING = /^Debugger listening on ws:\/\/[^:\s]+:(\d+\/\S+)/;
const INSPECTOR_NOISE = [
  /^For help, see: https:\/\/nodejs\.org\//,
  /^Debugger attached\.?$/,
  /^Waiting for the debugger to disconnect\.*$/,
];
// Chromium's renderer console lines: `[pid:…:ERROR:CONSOLE(4)] "message", source: file:///…/renderer.js (4)`;
// newer builds write `CONSOLE:4]`.
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
  /** What the current `push` or `flush` returns. */
  #result: ParseResult = { lines: [], errors: [] };

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
    return this.#collect(() => parts.forEach((line) => this.#parseLine(stream, line)));
  }

  /** Parses whatever is left, e.g. when the process exits. */
  flush(): ParseResult {
    return this.#collect(() => {
      for (const stream of ['stdout', 'stderr'] as const) {
        const rest = this.#partial[stream];
        this.#partial[stream] = '';
        if (rest) this.#parseLine(stream, rest);
      }
      if (this.#console) this.#finishConsole(undefined);
    });
  }

  #collect(parse: () => void): ParseResult {
    this.#result = { lines: [], errors: [] };
    parse();
    return this.#result;
  }

  #line(line: ParsedLine): void {
    this.#result.lines.push(line);
  }

  #parseLine(stream: 'stdout' | 'stderr', line: string): void {
    // A renderer console message that spans several lines.
    if (this.#console && stream === 'stderr') {
      const end = CONSOLE_END.exec(line);
      this.#console.parts.push(end ? line.slice(0, end.index) : line);
      if (end || this.#console.parts.length > MAX_CONTINUATION)
        this.#finishConsole(end ? { source: end[1]!, line: Number(end[2]) } : undefined);
      return;
    }

    const listening = INSPECTOR_LISTENING.exec(line);
    if (listening) {
      this.#result.inspectorAddress = listening[1];
      return;
    }
    if (INSPECTOR_NOISE.some((re) => re.test(line))) return;

    if (stream === 'stderr') {
      const start = CONSOLE_START.exec(line);
      if (start) {
        this.#mainError = undefined;
        const body = line.slice(start[0].length);
        const end = CONSOLE_END.exec(body);
        this.#console = {
          level: start[1]!,
          parts: [end ? body.slice(0, end.index) : body],
        };
        if (end) this.#finishConsole({ source: end[1]!, line: Number(end[2]) });
        return;
      }
      if (CHROMIUM_LOG.test(line)) {
        if (this.#options.chromiumLogs)
          this.#line({ process: 'main', kind: 'log', text: truncate(line) });
        return;
      }
    }
    this.#parseMainLine(line);
  }

  /** Main-process output, watching for an error header and its stack frames. */
  #parseMainLine(line: string): void {
    const pending = this.#mainError;
    if (pending && FRAME_ANY.test(line)) {
      const parsed: ParsedLine = { process: 'main', kind: 'error', text: truncate(line) };
      const frame = FRAME.exec(line);
      const file =
        frame && mapToFiddleFile(frame[1]!, this.#options.roots, this.#options.files);
      if (frame && file && !pending.located) {
        pending.located = true;
        parsed.location = { file, line: Number(frame[2]), column: Number(frame[3]) };
        this.#result.errors.push({
          ...parsed.location,
          process: processFor(file),
          name: pending.name,
          message: pending.message,
        });
      }
      this.#line(parsed);
      return;
    }

    const header = ERROR_HEADER.exec(line);
    this.#mainError = header
      ? { name: header[1]!, message: header[2] ?? '', located: false }
      : undefined;
    if (line !== '')
      this.#line({
        process: 'main',
        kind: header ? 'error' : 'log',
        text: truncate(line),
      });
  }

  #finishConsole(end: { source: string; line: number } | undefined): void {
    const pending = this.#console;
    this.#console = undefined;
    if (!pending) return;

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
        this.#result.errors.push({
          ...location,
          process: processFor(location.file) === 'preload' ? 'preload' : 'renderer',
          name: uncaught[1]!,
          message: firstLine,
        });
      }
    }
    this.#line(parsed);
  }

  /** A stack frame inside the run directory wins (it has a column); otherwise the `source`. */
  #locate(
    message: string,
    end: { source: string; line: number } | undefined,
  ): SourceLocation | undefined {
    const { roots, files } = this.#options;
    // Only the shown text is scanned: INLINE_FRAME is quadratic on a long run of `/`.
    for (const match of message.slice(0, MAX_LINE).matchAll(INLINE_FRAME)) {
      const file = mapToFiddleFile(match[1]!, roots, files);
      if (file) return { file, line: Number(match[2]), column: Number(match[3]) };
    }
    if (!end) return undefined;
    const file = mapToFiddleFile(end.source, roots, files);
    return file && end.line > 0 ? { file, line: end.line } : undefined;
  }
}
