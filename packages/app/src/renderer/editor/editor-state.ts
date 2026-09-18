/**
 * View-only editor state for this window (never persisted): the soft wrap and
 * minimap toggles, the focused editor, and its cursor for the status bar.
 */
import { createStore, useStore } from '../store';
import type { monaco } from './monaco';

export interface EditorViewState {
  softWrap: boolean;
  minimap: boolean;
  /** The file in the most recently focused editor, and its cursor. */
  cursor: { file: string; line: number; column: number } | null;
}

const view = createStore<EditorViewState>({
  softWrap: true,
  minimap: false,
  cursor: null,
});
let focused: monaco.editor.IStandaloneCodeEditor | null = null;

const set = (patch: Partial<EditorViewState>) => view.set({ ...view.get(), ...patch });

export const useEditorViewState = (): EditorViewState => useStore(view);

export const toggleSoftWrap = () => set({ softWrap: !view.get().softWrap });
export const toggleMinimap = () => set({ minimap: !view.get().minimap });

export function setCursor(file: string, line: number, column: number): void {
  const current = view.get().cursor;
  if (current?.file === file && current.line === line && current.column === column)
    return;
  set({ cursor: { file, line, column } });
}

export function setFocusedEditor(
  editor: monaco.editor.IStandaloneCodeEditor | null,
): void {
  focused = editor;
}

/** A disposed editor stops being the focused one; another pane's editor stays it. */
export function clearFocusedEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
  if (focused === editor) focused = null;
}

export async function formatFocusedEditor(): Promise<void> {
  await focused?.getAction('editor.action.formatDocument')?.run();
}
