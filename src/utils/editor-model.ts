import { editor } from 'monaco-editor';

import { EditorId } from '../interfaces';

/**
 * Return the model for a given editor
 *
 * @param {EditorId} id
 * @returns {editor.ITextModel | null}
 */
export function getEditorModel(id: EditorId): editor.ITextModel | null {
  if (window.ElectronFiddle?.app?.state) {
    const { editorMosaic } = window.ElectronFiddle.app.state;

    const editor = editorMosaic.editors.get(id);
    if (editor) return editor.getModel();
  }

  return null;
}
