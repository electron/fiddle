import { Editor } from '../renderer/state';

/**
 * Returns the currently focused editor.
 *
 * @returns {(MonacoType.editor.IStandaloneCodeEditor | null)}
 */
export function getFocusedEditor(): Editor | null {
  const { editorMosaic } = window.ElectronFiddle.app.state;

  for (const editor of editorMosaic.editors.values()) {
    if (editor.hasTextFocus()) {
      return editor;
    }
  }

  return null;
}
