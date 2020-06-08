import { EditorId } from '../interfaces';
import { EditorBackup } from './editor-backup';

/**
 * Return the value for a given editor
 *
 * @param {EditorId} id
 * @returns {string}
 */
export function getEditorValue(id: EditorId): string {
  const { ElectronFiddle: fiddle } = window;

  if (!fiddle) {
    return '';
  }

  const editor = fiddle.editors[id];
  const backup = fiddle.app?.state?.closedPanels[id] as EditorBackup;

  if (editor?.getValue) {
    return fiddle.editors[id]!.getValue();
  } else if (backup?.value) {
    return backup.value;
  }

  return '';
}
