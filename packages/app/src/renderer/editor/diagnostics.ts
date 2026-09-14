/**
 * Per-file diagnostics for the tab badges, sidebar pills and pane headers
 * (REQUIREMENTS §17.2): the running fiddle's runtime errors plus Monaco's own
 * markers (syntax errors and warnings). `models.ts` reports the markers; this
 * module has no Monaco import, so the merge runs anywhere.
 */
import { useMemo, useSyncExternalStore } from 'react';

import { useRuntimeErrors } from './runtime-errors';

export interface EditorMarker {
  file: string;
  severity: 'error' | 'warning';
}

export interface FileDiagnostics {
  errors: number;
  warnings: number;
}

const EMPTY: readonly EditorMarker[] = [];
let markers: readonly EditorMarker[] = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replaces Monaco's error and warning markers, one entry per marker. */
export function setEditorMarkers(next: readonly EditorMarker[]): void {
  if (next.length === 0 && markers.length === 0) return;
  markers = next.length ? [...next] : EMPTY;
  for (const listener of listeners) listener();
}

/** Runtime errors count as errors; Monaco's markers count by severity. Files without any are left out. */
export function mergeDiagnostics(
  runtime: readonly { file: string }[],
  editor: readonly EditorMarker[],
): ReadonlyMap<string, FileDiagnostics> {
  const result = new Map<string, FileDiagnostics>();
  const entry = (file: string) => {
    let value = result.get(file);
    if (!value) result.set(file, (value = { errors: 0, warnings: 0 }));
    return value;
  };
  for (const error of runtime) entry(error.file).errors += 1;
  for (const marker of editor) {
    if (marker.severity === 'error') entry(marker.file).errors += 1;
    else entry(marker.file).warnings += 1;
  }
  return result;
}

export function useDiagnostics(): ReadonlyMap<string, FileDiagnostics> {
  const runtime = useRuntimeErrors();
  const editor = useSyncExternalStore(subscribe, () => markers);
  return useMemo(() => mergeDiagnostics(runtime, editor), [runtime, editor]);
}

/** What a badge or pill shows: the error count, or the warning count when there are no errors. */
export function badgeOf(diagnostics: FileDiagnostics | undefined): { count: number; tone: 'error' | 'warning' } | null {
  if (diagnostics?.errors) return { count: diagnostics.errors, tone: 'error' };
  if (diagnostics?.warnings) return { count: diagnostics.warnings, tone: 'warning' };
  return null;
}
