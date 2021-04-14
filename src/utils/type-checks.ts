import { EditorBackup } from './editor-backup';
import { isKnownFile } from './editor-utils';

/**
 * Is the given string of type `EditorId`?
 *
 * @export
 * @param {string} id
 * @param {customEditors} other editors to check against
 * @returns {boolean} true iff the string is an editor id
 */
export function isEditorId(id: string, customEditors: string[]): boolean {
  return isKnownFile(id) || customEditors.includes(id as any);
}

/**
 * Is the given input of type `EditorBackup`?
 *
 * @export
 * @param {(EditorBackup | true)} input
 * @returns {input is EditorBackup}
 */
export function isEditorBackup(
  input?: EditorBackup | true | null,
): input is EditorBackup {
  return !!(input && input !== true);
}
