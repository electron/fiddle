import { editor } from 'monaco-editor';

import { EditorId } from '../interfaces';
import { getEditorModel } from './editor-model';
import { getEditorViewState } from './editor-viewstate';

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
  const { editorMosaic } = (window as any).ElectronFiddle.app.state;

  return {
    value: editorMosaic.getEditorValue(id),
    model: getEditorModel(id),
    viewState: getEditorViewState(id),
  };
}
