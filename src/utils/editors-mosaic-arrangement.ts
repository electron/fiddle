import { MosaicDirection, MosaicNode } from 'react-mosaic-component';

import { EditorId } from '../interfaces';

/**
 * Create a mosaic arrangement given an array of editor ids.
 *
 * @export
 * @param {Array<EditorId>} input
 * @returns {MosaicNode<EditorId>}
 */
export function createMosaicArrangement(
  input: readonly EditorId[],
  direction: MosaicDirection = 'row',
): MosaicNode<EditorId> {
  if (input.length === 1) {
    return input[0];
  }

  // This cuts out the first half of input. Input becomes the second half.
  const secondHalf = [...input];
  const firstHalf = secondHalf.splice(0, Math.floor(secondHalf.length / 2));

  return {
    direction,
    first: createMosaicArrangement(firstHalf, 'column'),
    second: createMosaicArrangement(secondHalf, 'column'),
  };
}

/**
 * Returns an array of visible editors given a mosaic arrangement.
 *
 * @export
 * @param {MosaicNode<EditorId> | null} input
 * @returns {Array<EditorId>}
 */
export function getVisibleMosaics(
  input: MosaicNode<EditorId> | null,
): Array<EditorId> {
  // Handle the unlikely null case
  if (!input) return [];

  // Handle the case where only one editor is visible
  if (typeof input === 'string') {
    return [input as EditorId];
  }

  // Handle the other cases (2 - 4)
  const result: Array<EditorId> = [];
  for (const node of [input.first, input.second]) {
    if (typeof node === 'string') {
      result.push(node as EditorId);
    } else {
      result.push(...getVisibleMosaics(node));
    }
  }

  return result;
}
