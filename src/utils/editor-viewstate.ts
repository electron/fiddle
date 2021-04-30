import { editor } from 'monaco-editor';

import { EditorId } from '../interfaces';

/**
 * Returns the view state for a given editor.
 *
 * @export
 * @param {EditorId} id
 * @returns {(editor.ICodeEditorViewState | null)}
 */
export function getEditorViewState(
  id: EditorId,
): editor.ICodeEditorViewState | null {
  return (
    window.ElectronFiddle?.app?.state.editorMosaic.editors
      .get(id)
      ?.saveViewState() || null
  );
}
