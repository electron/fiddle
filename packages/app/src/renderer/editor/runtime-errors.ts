/**
 * Runtime errors thrown by the running fiddle, shown as tab badges, sidebar
 * pills, the error line and the error lens.
 *
 * A tiny external store. Versions and run calls `setRuntimeErrors` (and
 * `revealLocation` for the console's location links); the shell reads it with
 * `useRuntimeErrors`.
 */
import type { RuntimeErrorValue } from '../../shared/stores';
import { createStore, useStore } from '../store';

export interface RuntimeError {
  /** A fiddle file name, such as `renderer.js`. */
  file: string;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  /** As thrown, such as "TypeError: Cannot read properties of undefined". */
  message: string;
  /** The Electron process it was thrown in (main's report, not the file's sidebar group). */
  process: RuntimeErrorValue['process'];
}

export interface RevealRequest {
  file: string;
  line: number;
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
  a.message === b.message &&
  a.process === b.process;

/**
 * Replaces the current errors. Pass `[]` to clear them (for example on the
 * next run). A list equal to the current one changes nothing, so the error
 * lenses aren't rebuilt by every store push.
 */
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

/** Opens the file's editor and moves the cursor to the location. */
export function revealLocation(file: string, line: number, column: number): void {
  reveal.set({ file, line, column, seq: (reveal.get()?.seq ?? 0) + 1 });
}

export const useRevealRequest = (): RevealRequest | null => useStore(reveal);

/** True the first time a request is claimed, so one pane acts on it and a pane mounted later doesn't replay it. */
export function claimReveal(seq: number): boolean {
  if (seq <= claimedSeq) return false;
  claimedSeq = seq;
  return true;
}

/** Splits "TypeError: message" into its type name and the rest. */
export function splitErrorMessage(message: string): {
  title: string | null;
  text: string;
} {
  const match =
    /^(?:Uncaught\s+)?([A-Za-z_$][\w$]*(?:Error|Exception)):\s*([\s\S]*)$/.exec(
      message.trim(),
    );
  return match
    ? { title: match[1] ?? null, text: match[2] ?? '' }
    : { title: null, text: message.trim() };
}
