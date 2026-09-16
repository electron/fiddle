/**
 * Runtime errors thrown by the running fiddle, shown as the design's error
 * markers: tab badges, sidebar pills, the error line and the error lens.
 *
 * A tiny external store. Versions and run calls `setRuntimeErrors` (and
 * `revealLocation` for the console's location links); the shell reads it with
 * `useRuntimeErrors`.
 */
import { useSyncExternalStore } from 'react';

import type { RuntimeErrorValue } from '../../shared/stores';

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
let errors: readonly RuntimeError[] = EMPTY;
let reveal: RevealRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replaces the current errors. Pass `[]` to clear them (for example on the next run). */
export function setRuntimeErrors(next: readonly RuntimeError[]): void {
  errors = next.length ? [...next] : EMPTY;
  emit();
}

export function getRuntimeErrors(): readonly RuntimeError[] {
  return errors;
}

export function useRuntimeErrors(): readonly RuntimeError[] {
  return useSyncExternalStore(subscribe, getRuntimeErrors);
}

/** Opens the file's editor and moves the cursor to the location. */
export function revealLocation(file: string, line: number, column: number): void {
  reveal = { file, line, column, seq: (reveal?.seq ?? 0) + 1 };
  emit();
}

export function useRevealRequest(): RevealRequest | null {
  return useSyncExternalStore(subscribe, () => reveal);
}

/** Error counts by file name. */
export function countByFile(list: readonly RuntimeError[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const error of list) counts.set(error.file, (counts.get(error.file) ?? 0) + 1);
  return counts;
}

/** Splits "TypeError: message" into its type name and the rest. */
export function splitErrorMessage(message: string): { title: string | null; text: string } {
  const match = /^(?:Uncaught\s+)?([A-Za-z_$][\w$]*(?:Error|Exception)):\s*([\s\S]*)$/.exec(message.trim());
  return match ? { title: match[1] ?? null, text: match[2] ?? '' } : { title: null, text: message.trim() };
}
