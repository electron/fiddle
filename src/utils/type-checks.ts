import {
  ALL_PANELS,
  DefaultEditorId,
  DEFAULT_EDITORS,
  EditorId,
  MosaicId,
  PanelId,
} from '../interfaces';
import { EditorBackup } from './editor-backup';

/**
 * Is the given string of type `EditorId`?
 *
 * @export
 * @param {(EditorId | PanelId | MosaicId)} input
 * @returns {input is EditorId}
 */
export function isEditorId(
  input: MosaicId,
  editors: string[],
): input is EditorId {
  return (
    DEFAULT_EDITORS.includes(input as DefaultEditorId) ||
    editors.includes(input as EditorId)
  );
}

/**
 * Is the given string of type `isPanelId`?
 *
 * @export
 * @param {(EditorId | PanelId | MosaicId)} input
 * @returns {input is MosaicId}
 */
export function isPanelId(
  input: EditorId | PanelId | MosaicId,
): input is PanelId {
  return ALL_PANELS.includes(input as PanelId);
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
