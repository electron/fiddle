/**
 * View-only editor state for this window (never persisted): the soft wrap and
 * minimap toggles, the focused editor, and its cursor for the status bar.
 */
import { useSyncExternalStore } from 'react';

import type { monaco } from './monaco';

export interface EditorViewState {
  softWrap: boolean;
  minimap: boolean;
  /** The file in the most recently focused editor, and its cursor. */
  cursor: { file: string; line: number; column: number } | null;
}

let state: EditorViewState = { softWrap: true, minimap: false, cursor: null };
let focused: monaco.editor.IStandaloneCodeEditor | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<EditorViewState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function useEditorViewState(): EditorViewState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export const toggleSoftWrap = () => set({ softWrap: !state.softWrap });
export const toggleMinimap = () => set({ minimap: !state.minimap });

export function setCursor(file: string, line: number, column: number): void {
  const current = state.cursor;
  if (current?.file === file && current.line === line && current.column === column) return;
  set({ cursor: { file, line, column } });
}

export function setFocusedEditor(editor: monaco.editor.IStandaloneCodeEditor | null): void {
  focused = editor;
}

/** A disposed editor stops being the focused one; another pane's editor stays it. */
export function clearFocusedEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
  if (focused === editor) focused = null;
}

/** Runs Monaco's format action in the focused editor. */
export async function formatFocusedEditor(): Promise<void> {
  await focused?.getAction('editor.action.formatDocument')?.run();
}
