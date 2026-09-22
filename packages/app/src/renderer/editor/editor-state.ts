import { documentsApi } from '../../ipc/renderer';
import { createStore, useStore } from '../store';
import type { monaco } from './monaco';

type Editor = monaco.editor.IStandaloneCodeEditor;

export interface EditorViewState {
  softWrap: boolean;
  minimap: boolean;
}

/** The file in the most recently focused editor, and its cursor. */
export type EditorCursor = { file: string; line: number; column: number } | null;

const view = createStore<EditorViewState>({ softWrap: true, minimap: false });
// Its own store: it changes on every keystroke, and only the status bar's position readout follows it.
const cursor = createStore<EditorCursor>(null);
/** Every pane's editor, first pane first. */
const editors = new Set<Editor>();
let focused: Editor | null = null;

const set = (patch: Partial<EditorViewState>) => view.set({ ...view.get(), ...patch });

export const useEditorViewState = (): EditorViewState => useStore(view);
export const useEditorCursor = (): EditorCursor => useStore(cursor);

export const toggleSoftWrap = () => set({ softWrap: !view.get().softWrap });
export const toggleMinimap = () => set({ minimap: !view.get().minimap });

export function setCursor(file: string, line: number, column: number): void {
  const current = cursor.get();
  if (current?.file === file && current.line === line && current.column === column)
    return;
  cursor.set({ file, line, column });
}

export function addEditor(editor: Editor): void {
  editors.add(editor);
}

export function setFocusedEditor(editor: Editor): void {
  focused = editor;
}

/** A disposed editor stops being a target; another pane's editor that had focus keeps it. */
export function removeEditor(editor: Editor): void {
  editors.delete(editor);
  if (focused === editor) focused = null;
}

/** The editor that commands act on: the last one with text focus, else the first pane's. */
export function targetEditor(): Editor | null {
  return focused ?? editors.values().next().value ?? null;
}

/** The target editor's actions, for the command palette. Empty if Monaco refuses, so the palette still opens. */
export function getEditorActions(): { id: string; label: string; run(): unknown }[] {
  try {
    return (targetEditor()?.getSupportedActions() ?? []).map((action) => ({
      id: action.id,
      label: action.label,
      run: () => action.run(),
    }));
  } catch (error) {
    console.error('[fiddle] listing the editor actions failed', error);
    return [];
  }
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

/** Renames a file through main. Its model is recreated under the new name, so its view state moves to it. */
export async function renameFile(from: string, to: string): Promise<void> {
  renames.set(from, to);
  try {
    await documentsApi.RenameFile(from, to);
  } catch (error) {
    renames.delete(from);
    throw error;
  }
}

export async function formatFocusedEditor(): Promise<void> {
  await targetEditor()?.getAction('editor.action.formatDocument')?.run();
}
