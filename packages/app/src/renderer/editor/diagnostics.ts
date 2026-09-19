import { useMemo } from 'react';

import { createStore, useStore } from '../store';
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
const markers = createStore(EMPTY);

export function setEditorMarkers(next: readonly EditorMarker[]): void {
  if (next.length === 0 && markers.get().length === 0) return;
  markers.set(next.length ? [...next] : EMPTY);
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
  const editor = useStore(markers);
  return useMemo(() => mergeDiagnostics(runtime, editor), [runtime, editor]);
}

/** What a badge or pill shows: the error count, or the warning count when there are no errors. */
export function badgeOf(
  diagnostics: FileDiagnostics | undefined,
): { count: number; tone: 'error' | 'warning' } | null {
  if (diagnostics?.errors) return { count: diagnostics.errors, tone: 'error' };
  if (diagnostics?.warnings) return { count: diagnostics.warnings, tone: 'warning' };
  return null;
}
