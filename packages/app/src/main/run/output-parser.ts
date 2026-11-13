import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { previewText } from '../../shared/console-preview';
import {
  consoleValueSchema,
  type ConsoleValue,
  type OutputLine,
  type RuntimeErrorValue,
  type SourceLocation,
} from '../../shared/stores';

export type ParsedLine = Omit<OutputLine, 'seq' | 'time'>;

interface ParserOptions {
  /** The run directory, plus its real path if that differs (macOS /var → /private/var). */
  roots: readonly string[];
  /** The fiddle's file names. Only these are mapped. */
  files: readonly string[];
  /** Keep Chromium's own log lines (the "advanced logging" setting). */
  chromiumLogs: boolean;
}

/** The arguments of an earlier line's console call, which arrived after it. */
export interface LineUpdate {
  line: ParsedLine;
  values: ConsoleValue[];
  text: string;
}

export interface ParseResult {
  lines: ParsedLine[];
  /** Values for lines returned earlier. */
  updates: LineUpdate[];
  errors: RuntimeErrorValue[];
  /** Set when the inspector banner announced its address: `port/id`, the id being what authorises an attach. */
  inspectorAddress?: string;
}

const MAX_LINE = 10_000;
/** A runtime error's message lives in the Window store, so it is kept much shorter than a console line. */
const MAX_MESSAGE = 1000;
const MAX_CONTINUATION = 200;
/** How many renderer console lines wait for their values. */
const MAX_AWAITING = 100;
/** A record from the console hook (`console-hook.cjs`), whose prefix is the same. */
export const RECORD_PREFIX = '\u001efiddle-console ';
const MAX_RECORD = 512 * 1024;
const recordSchema = z.object({
  source: z.string(),
  line: z.number(),
  text: z.string(),
  values: z.array(consoleValueSchema),
});

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

function truncate(text: string, max = MAX_LINE): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** A 1-based line or column from a stack frame. `0`, and digit runs too long to be a position, give none. */
function position(digits: string): number | undefined {
  const n = Number(digits);
  return Number.isSafeInteger(n) && n >= 1 ? n : undefined;
}

/** The location for a mapped frame, if its line is usable. A `0` column is left out. */
function locationAt(
  file: string,
  line: string,
  column?: string,
): SourceLocation | undefined {
  const at = position(line);
  if (at === undefined) return undefined;
  const col = column === undefined ? undefined : position(column);
  return col === undefined ? { file, line: at } : { file, line: at, column: col };
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

/** What matches a console hook record to Chromium's line for the same call. */
const consoleKey = (source: string, line: string | number, text: string) =>
  `${source}\n${line}\n${truncate(text)}`;

export class OutputParser {
  readonly #options: ParserOptions;
  readonly #partial = { stdout: '', stderr: '' };
  #console: PendingConsole | undefined;
  #mainError: PendingMainError | undefined;
  /** Recent renderer console lines, oldest first, that a hook record can still fill in. */
  #awaiting: { key: string; line: ParsedLine }[] = [];
  /** What the current `push` or `flush` returns. */
  #result: ParseResult = { lines: [], updates: [], errors: [] };

  constructor(options: ParserOptions) {
    this.#options = options;
  }

  /** Feeds a chunk. Complete lines are parsed; a trailing partial line waits. */
  push(stream: 'stdout' | 'stderr', chunk: string): ParseResult {
    const parts = (this.#partial[stream] + chunk).split(/\r?\n/);
    const partial = parts.pop() ?? '';
    // Only the first MAX_LINE characters of an unfinished line are ever shown,
    // so a huge line without a newline doesn't pile up or get re-scanned.
    // A hook record is read whole, up to its own limit.
    const max = partial.startsWith(RECORD_PREFIX) ? MAX_RECORD : MAX_LINE;
    this.#partial[stream] = partial.length > max ? partial.slice(0, max + 1) : partial;
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
    this.#result = { lines: [], updates: [], errors: [] };
    parse();
    return this.#result;
  }

  #parseLine(stream: 'stdout' | 'stderr', line: string): void {
    if (stream === 'stderr' && line.startsWith(RECORD_PREFIX)) {
      this.#record(line.slice(RECORD_PREFIX.length));
      return;
    }
    // A renderer console message that spans several lines.
    if (this.#console && stream === 'stderr') {
      const end = CONSOLE_END.exec(line);
      this.#console.parts.push(end ? line.slice(0, end.index) : line);
      if (end || this.#console.parts.length > MAX_CONTINUATION)
        this.#finishConsole(end ? { source: end[1]!, line: end[2]! } : undefined);
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
        if (end) this.#finishConsole({ source: end[1]!, line: end[2]! });
        return;
      }
      if (CHROMIUM_LOG.test(line)) {
        if (this.#options.chromiumLogs)
          this.#result.lines.push({ process: 'main', kind: 'log', text: truncate(line) });
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
      const location = file ? locationAt(file, frame[2]!, frame[3]) : undefined;
      if (location && !pending.located) {
        pending.located = true;
        parsed.location = location;
        this.#result.errors.push({
          ...location,
          process: processFor(location.file),
          name: pending.name,
          message: pending.message,
        });
      }
      this.#result.lines.push(parsed);
      return;
    }

    const header = ERROR_HEADER.exec(line);
    this.#mainError = header
      ? {
          name: header[1]!,
          message: truncate(header[2] ?? '', MAX_MESSAGE),
          located: false,
        }
      : undefined;
    if (line !== '')
      this.#result.lines.push({
        process: 'main',
        kind: header ? 'error' : 'log',
        text: truncate(line),
      });
  }

  #finishConsole(end: { source: string; line: string } | undefined): void {
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
    if (end) {
      this.#awaiting.push({
        key: consoleKey(end.source, end.line, message),
        line: parsed,
      });
      if (this.#awaiting.length > MAX_AWAITING) this.#awaiting.shift();
    }

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
          message: truncate(firstLine, MAX_MESSAGE),
        });
      }
    }
    this.#result.lines.push(parsed);
  }

  /**
   * A console hook record: the values of a renderer console call. It always comes after Chromium's
   * line for the call, since the hook serializes the values with a round trip to the page.
   */
  #record(json: string): void {
    let record;
    try {
      record = recordSchema.parse(JSON.parse(json));
    } catch {
      return;
    }
    const key = consoleKey(record.source, record.line, record.text);
    const index = this.#awaiting.findIndex((entry) => entry.key === key);
    if (index === -1) return;
    const { line } = this.#awaiting.splice(index, 1)[0]!;
    this.#result.updates.push({
      line,
      values: record.values,
      text: previewText(record.values),
    });
  }

  /** A stack frame inside the run directory wins (it has a column); otherwise the `source`. */
  #locate(
    message: string,
    end: { source: string; line: string } | undefined,
  ): SourceLocation | undefined {
    const { roots, files } = this.#options;
    // Only the shown text is scanned: INLINE_FRAME is quadratic on a long run of `/`.
    for (const match of message.slice(0, MAX_LINE).matchAll(INLINE_FRAME)) {
      const file = mapToFiddleFile(match[1]!, roots, files);
      const location = file ? locationAt(file, match[2]!, match[3]) : undefined;
      if (location) return location;
    }
    const file = end && mapToFiddleFile(end.source, roots, files);
    return file ? locationAt(file, end.line) : undefined;
  }
}
