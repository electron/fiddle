import type { RuntimeErrorValue } from '../../shared/stores';
import { createStore, useStore } from '../store';

/** Main's report of an uncaught error: 1-based, in the Electron process it was thrown in (not the file's sidebar group). */
export type RuntimeError = RuntimeErrorValue;

export interface RevealRequest {
  file: string;
  /** Left out, the cursor stays where it was. */
  line?: number;
  column: number;
  /** Increases with every request, so asking twice for one place reveals it twice. */
  seq: number;
}

const EMPTY: readonly RuntimeError[] = [];
const errors = createStore(EMPTY);
const reveal = createStore<RevealRequest | null>(null);
let claimedSeq = 0;

const sameError = (a: RuntimeError, b: RuntimeError) =>
  a.file === b.file &&
  a.line === b.line &&
  a.column === b.column &&
  a.name === b.name &&
  a.message === b.message &&
  a.process === b.process;

/** A list equal to the current one changes nothing, so the error lenses aren't rebuilt by every store push. */
export function setRuntimeErrors(next: readonly RuntimeError[]): void {
  const current = errors.get();
  if (
    next.length === current.length &&
    next.every((error, i) => sameError(error, current[i]!))
  )
    return;
  errors.set(next.length ? [...next] : EMPTY);
}

export const getRuntimeErrors = errors.get;

export const useRuntimeErrors = (): readonly RuntimeError[] => useStore(errors);

/** Shows `file` and gives its editor the keyboard focus, with the cursor at `line` if there is one. */
export function revealLocation(file: string, line?: number, column = 1): void {
  reveal.set({ file, line, column, seq: (reveal.get()?.seq ?? 0) + 1 });
}

export const useRevealRequest = (): RevealRequest | null => useStore(reveal);

/** True the first time a request is claimed, so one pane acts on it and a pane mounted later doesn't replay it. */
export function claimReveal(seq: number): boolean {
  if (seq <= claimedSeq) return false;
  claimedSeq = seq;
  return true;
}
