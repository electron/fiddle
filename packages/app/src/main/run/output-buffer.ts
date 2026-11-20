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
    // Both arrays are trimmed in bulk, at twice the limit, so a chatty fiddle
    // doesn't pay for a front splice on every line. Readers cap them.
    this.#lines.push(full);
    if (this.#lines.length >= 2 * OUTPUT_LIMIT)
      this.#lines = this.#lines.slice(-OUTPUT_LIMIT);
    this.#pending.push(full);
    if (this.#pending.length >= 2 * OUTPUT_LIMIT)
      this.#pending = this.#pending.slice(-OUTPUT_LIMIT);
    this.#timer ??= setTimeout(() => this.flush(), OUTPUT_BATCH_MS);
    return full;
  }

  /** Changes a line that's still in the backlog, and sends it again with the same `seq`. */
  update(seq: number, patch: Partial<Omit<OutputLine, 'seq' | 'time'>>): void {
    const index = this.#lines.findLastIndex((line) => line.seq === seq);
    if (index === -1) return;
    const updated = { ...this.#lines[index]!, ...patch };
    this.#lines[index] = updated;
    const pending = this.#pending.findLastIndex((line) => line.seq === seq);
    if (pending === -1) this.#pending.push(updated);
    else this.#pending[pending] = updated;
    this.#timer ??= setTimeout(() => this.flush(), OUTPUT_BATCH_MS);
  }

  flush(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    if (this.#pending.length === 0) return;
    // A batch never carries more than the backlog holds.
    const batch = this.#pending.slice(-OUTPUT_LIMIT);
    this.#pending = [];
    this.#send(batch);
  }

  get lines(): readonly OutputLine[] {
    return this.#lines.length > OUTPUT_LIMIT
      ? this.#lines.slice(-OUTPUT_LIMIT)
      : this.#lines;
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
