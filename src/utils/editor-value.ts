import { EditorId } from '../interfaces';

/**
 * Return the value for a given editor
 *
 * @param {EditorId} id
 * @returns {string}
 */
export function getEditorValue(id: EditorId): string {
  if (window.ElectronFiddle?.app?.state) {
    const { editorMosaic } = window.ElectronFiddle.app.state;

    const editor = editorMosaic.editors.get(id);
    if (editor) return editor.getValue();

    const backup = editorMosaic.closedPanels[id];
    if (backup?.value) return backup.value;
  }

  return '';
}
