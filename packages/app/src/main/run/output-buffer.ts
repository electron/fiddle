/**
 * One window's console output (§3 "Operations"): every line gets a sequence
 * number, new lines go out in batches every 16 ms, and the last 1000 lines are
 * kept for `Run.GetOutput()`. No Electron imports.
 */
import type { OutputLine } from '../../shared/stores';

export const OUTPUT_LIMIT = 1000;
export const OUTPUT_BATCH_MS = 16;

export class OutputBuffer {
  #lines: OutputLine[] = [];
  #pending: OutputLine[] = [];
  #seq = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #send: (lines: OutputLine[]) => void;
  readonly #now: () => number;

  constructor(send: (lines: OutputLine[]) => void, now: () => number = Date.now) {
    this.#send = send;
    this.#now = now;
  }

  push(line: Omit<OutputLine, 'seq' | 'time'>): OutputLine {
    const full: OutputLine = { ...line, seq: ++this.#seq, time: this.#now() };
    this.#lines.push(full);
    if (this.#lines.length > OUTPUT_LIMIT) this.#lines.splice(0, this.#lines.length - OUTPUT_LIMIT);
    // Capped at the source: a batch never carries more than the backlog holds.
    this.#pending.push(full);
    if (this.#pending.length > OUTPUT_LIMIT) this.#pending.splice(0, this.#pending.length - OUTPUT_LIMIT);
    this.#timer ??= setTimeout(() => this.flush(), OUTPUT_BATCH_MS);
    return full;
  }

  /** Sends pending lines now. */
  flush(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    if (this.#pending.length === 0) return;
    const batch = this.#pending;
    this.#pending = [];
    this.#send(batch);
  }

  /** The backlog, oldest first. */
  get lines(): readonly OutputLine[] {
    return this.#lines;
  }

  get lastSeq(): number {
    return this.#seq;
  }

  /** Empties the backlog. Returns the last sequence number, for `Window.run.clearedSeq`. */
  clear(): number {
    this.#lines = [];
    return this.#seq;
  }

  dispose(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#pending = [];
  }
}
