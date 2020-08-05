import { editor } from 'monaco-editor';

import { EditorId } from '../interfaces';

/**
 * Return the model for a given editor
 *
 * @param {EditorId} id
 * @returns {editor.ITextModel | null}
 */
export function getEditorModel(id: EditorId): editor.ITextModel | null {
  const { ElectronFiddle: fiddle } = window;

  if (!fiddle) {
    return null;
  }

  if (fiddle.editors[id] && fiddle.editors[id]!.getModel) {
    return fiddle.editors[id]!.getModel();
  }

  return null;
}
