import { constants } from 'node:os';

import { ErrorCode, type SerializedFiddleError } from '../../shared/errors';

/** With `--json`, stdout is one object per line, each with this `schemaVersion`: `log`, `output`, then a last `result` (`ok`, and `data` or `error`). */
export const SCHEMA_VERSION = 1;

/** Error codes the CLI adds to the shared ones. */
export const CliErrorCode = {
  /** A remote fiddle, without --trust or a yes at the prompt. */
  untrusted: 'untrusted',
  /** An auto bisect couldn't finish. */
  bisectFailed: 'bisect-failed',
  /** npm, yarn or Forge failed. */
  taskFailed: 'task-failed',
} as const;

/** sysexits-style exit codes for errors; others exit 1. `run` exits with the fiddle's own code. */
const EXIT_CODES: Readonly<Record<string, number>> = {
  [ErrorCode.invalidArgument]: 64, // EX_USAGE
  [ErrorCode.notFound]: 66, // EX_NOINPUT
  [ErrorCode.unavailable]: 69, // EX_UNAVAILABLE
  [ErrorCode.internal]: 70, // EX_SOFTWARE
  [ErrorCode.network]: 75, // EX_TEMPFAIL
  [ErrorCode.unauthorized]: 77, // EX_NOPERM
  [ErrorCode.forbidden]: 77,
  [CliErrorCode.untrusted]: 77,
  [ErrorCode.cancelled]: 130, // like Ctrl+C
};

export function exitCodeForError(code: string): number {
  return EXIT_CODES[code] ?? 1;
}

/** The fiddle's exit code. A signal gives 128 + its number, as in a shell; a failed spawn gives 1. */
export function exitCodeForRun(outcome: {
  code?: number | null;
  signal?: string | null;
}): number {
  if (outcome.signal) {
    const number = (constants.signals as Readonly<Record<string, number>>)[
      outcome.signal
    ];
    return number === undefined ? 1 : 128 + number;
  }
  return typeof outcome.code === 'number' ? outcome.code : 1;
}

/** The locale from `LC_ALL`, `LC_MESSAGES` or `LANG`, first set wins, as a BCP 47 tag. */
export function localeFromEnv(env: NodeJS.ProcessEnv): string[] {
  const raw = [env.LC_ALL, env.LC_MESSAGES, env.LANG].find(
    (value) => value !== undefined && value !== '',
  );
  if (raw === undefined) return [];
  const tag = raw.split(/[.@]/)[0]!.replace(/_/g, '-');
  return tag === '' || tag === 'C' || tag === 'POSIX' ? ['en'] : [tag];
}

export interface Writers {
  stdout(text: string): void;
  stderr(text: string): void;
}

type Stream = 'stdout' | 'stderr';
export type LogLevel = 'info' | 'warn' | 'error';

export class Reporter {
  readonly json: boolean;
  readonly command: string | null;
  readonly #io: Writers;
  readonly #partial: Record<Stream, string> = { stdout: '', stderr: '' };

  constructor(json: boolean, command: string | null, io: Writers) {
    this.json = json;
    this.command = command;
    this.#io = io;
  }

  log(text: string, level: LogLevel = 'info'): void {
    if (this.json) this.#event({ type: 'log', level, text });
    else this.#io.stderr(`${text}\n`);
  }

  /** The fiddle's or a tool's output: passed through, or one `output` event per line. */
  output(stream: Stream, chunk: string): void {
    if (!this.json) {
      this.#io[stream](chunk);
      return;
    }
    const lines = (this.#partial[stream] + chunk).split(/\r?\n/);
    this.#partial[stream] = lines.pop() ?? '';
    for (const text of lines) this.#event({ type: 'output', stream, text });
  }

  /** Emits what's left of an unfinished output line. */
  flush(): void {
    for (const stream of ['stdout', 'stderr'] as const) {
      const text = this.#partial[stream];
      this.#partial[stream] = '';
      if (text !== '') this.#event({ type: 'output', stream, text });
    }
  }

  /** The command's result. `human` is its text form; empty prints nothing. */
  result(data: unknown, human: string): void {
    this.flush();
    if (this.json) this.#event({ type: 'result', command: this.command, ok: true, data });
    else if (human !== '') this.#io.stdout(human.endsWith('\n') ? human : `${human}\n`);
  }

  /** `human` is the translated message for stderr. */
  error(error: SerializedFiddleError, human: string): void {
    this.flush();
    if (!this.json) {
      this.#io.stderr(`${human}\n`);
      return;
    }
    const base = { code: error.code, message: error.message };
    const withDetails =
      error.details === undefined ? base : { ...base, details: error.details };
    const event = { type: 'result', command: this.command, ok: false };
    try {
      this.#event({ ...event, error: withDetails });
    } catch {
      // Details that can't be serialized are dropped.
      this.#event({ ...event, error: base });
    }
  }

  #event(event: Record<string, unknown>): void {
    this.#io.stdout(`${JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...event })}\n`);
  }
}
