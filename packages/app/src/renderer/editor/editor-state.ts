/**
 * View-only editor state for this window (never persisted): the soft wrap and
 * minimap toggles, the focused editor, and its cursor for the status bar.
 */
import { documentsApi } from '../../ipc/renderer';
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

type ViewState = monaco.editor.ICodeEditorViewState | null;

/** Each file's cursor and scroll from when an editor last showed it, so showing it again picks up where it was left. */
const viewStates = new Map<string, ViewState>();
/** Renames asked for and not yet seen in the file list: old name to new name. */
const renames = new Map<string, string>();

export function saveViewState(file: string, state: ViewState): void {
  viewStates.set(file, state);
}

export function getViewState(file: string): ViewState | undefined {
  return viewStates.get(file);
}

/** The file's model is gone: its view state goes too, or moves to the new name if the file was renamed. */
export function releaseViewState(file: string): void {
  const state = viewStates.get(file);
  const renamed = renames.get(file);
  viewStates.delete(file);
  renames.delete(file);
  if (renamed !== undefined && state) viewStates.set(renamed, state);
}

/**
 * Renames a file through main. Its model is recreated under the new name (the
 * name is its URI), so the editor's view state is carried over to the new name.
 */
export async function renameFile(from: string, to: string): Promise<void> {
  renames.set(from, to);
  try {
    await documentsApi.RenameFile(from, to);
  } catch (error) {
    renames.delete(from);
    throw error;
  }
}

/** A disposed editor stops being the focused one; another pane's editor stays it. */
export function clearFocusedEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
  if (focused === editor) focused = null;
}

export async function formatFocusedEditor(): Promise<void> {
  await focused?.getAction('editor.action.formatDocument')?.run();
}
