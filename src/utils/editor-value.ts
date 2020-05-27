import { EditorId } from '../interfaces';

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

  if (fiddle.editors[id] && fiddle.editors[id]!.getValue) {
    return fiddle.editors[id]!.getValue();
  }

  return '';
}
