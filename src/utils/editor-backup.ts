import { editor } from 'monaco-editor';

import { EditorId } from '../interfaces';
import { getEditorValue } from './editor-value';

export interface EditorBackup {
  value?: string;
  model?: editor.ITextModel | null;
  viewState?: editor.ICodeEditorViewState | null;
}

/**
 * Returns a backup for a given editor
 *
 * @param {EditorId} id
 * @returns {EditorBackup}
 */
export function getEditorBackup(id: EditorId): EditorBackup {
  let model: editor.ITextModel | null = null;
  let viewState: editor.ICodeEditorViewState | null = null;

  const editor = window.ElectronFiddle?.editors?.[id];
  if (editor) {
    model = editor.getModel();
    viewState = editor.saveViewState();
  }

  return {
    model,
    value: getEditorValue(id),
    viewState,
  };
}
