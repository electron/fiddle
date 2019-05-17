import { MosaicDirection, MosaicNode } from 'react-mosaic-component';

import { MosaicId } from '../interfaces';

/**
 * Create a mosaic arrangement given an array of editor ids.
 *
 * @export
 * @param {Array<MosaicId>} input
 * @returns {MosaicNode<MosaicId>}
 */
export function createMosaicArrangement(
  input: Array<MosaicId>, direction: MosaicDirection = 'row'
): MosaicNode<MosaicId> {
  if (input.length === 1) {
    return input[0];
  }

  // This cuts out the first half of input. Input becomes the second half.
  const secondHalf = [ ...input ];
  const firstHalf = secondHalf.splice(0, Math.floor(secondHalf.length / 2));

  return {
    direction,
    first: createMosaicArrangement(firstHalf, 'column'),
    second: createMosaicArrangement(secondHalf, 'column')
  };
}

/**
 * Returns an array of visible editors given a mosaic arrangement.
 *
 * @export
 * @param {MosaicNode<MosaicId> | null} input
 * @returns {Array<MosaicId>}
 */
export function getVisibleMosaics(input: MosaicNode<MosaicId> | null): Array<MosaicId> {
  // Handle the unlikely null case
  if (!input) return [];

  // Handle the case where only one editor is visible
  if (typeof input === 'string') {
    return [ input ];
  }

  // Handle the other cases (2 - 4)
  const result = [];
  for (const node of [ input.first, input.second ]) {
    if (typeof node === 'string') {
      result.push(node);
    } else {
      result.push(...getVisibleMosaics(node));
    }
  }

  return result;
}
