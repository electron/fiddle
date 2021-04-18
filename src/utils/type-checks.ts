import { EditorBackup } from './editor-backup';

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
