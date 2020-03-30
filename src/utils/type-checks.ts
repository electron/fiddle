import { ALL_EDITORS, EditorId, MosaicId, PanelId } from '../interfaces';
import { EditorBackup } from './editor-backup';

/**
 * Is the given string of type `EditorId`?
 *
 * @export
 * @param {(EditorId | PanelId | MosaicId)} input
 * @returns {input is EditorId}
 */
export function isEditorId(input: EditorId | PanelId | MosaicId): input is EditorId {
  return (ALL_EDITORS as any).includes(input);
}

/**
 * Is the given string of type `isPanelId`?
 *
 * @export
 * @param {(EditorId | PanelId | MosaicId)} input
 * @returns {input is MosaicId}
 */
export function isPanelId(input: EditorId | PanelId | MosaicId): input is PanelId {
  return !(ALL_EDITORS as any).includes(input);
}

/**
 * Is the given input of type `EditorBackup`?
 *
 * @export
 * @param {(EditorBackup | true)} input
 * @returns {input is EditorBackup}
 */
export function isEditorBackup(input?: EditorBackup | true | null): input is EditorBackup {
  return !!(input && input !== true);
}
