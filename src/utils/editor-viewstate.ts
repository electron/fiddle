import { editor } from 'monaco-editor';

import { EditorId } from '../interfaces';

/**
 * Returns the view state for a given editor.
 *
 * @export
 * @param {EditorId} id
 * @returns {(editor.ICodeEditorViewState | null)}
 */
export function getEditorViewState(id: EditorId): editor.ICodeEditorViewState | null {
  const { ElectronFiddle: fiddle } = window;

  if (!fiddle) {
    throw new Error('Fiddle not ready');
  }

  if (fiddle.editors[id] && fiddle.editors[id]!.saveViewState) {
    return fiddle.editors[id]!.saveViewState();
  }

  return null;
}
