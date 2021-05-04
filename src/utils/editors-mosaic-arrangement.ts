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
  input: Array<EditorId>,
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
