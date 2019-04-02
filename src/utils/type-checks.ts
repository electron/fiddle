import { ALL_EDITORS, EditorId, MosaicId, PanelId } from '../interfaces';

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
 * Is the given string of type `MosaicId`?
 *
 * @export
 * @param {(EditorId | PanelId | MosaicId)} input
 * @returns {input is MosaicId}
 */
export function isMosaicId(input: EditorId | PanelId | MosaicId): input is MosaicId {
  return !(ALL_EDITORS as any).includes(input);
}
