import { MosaicNode } from 'react-mosaic-component';

import { EditorId } from '../interfaces';
import { DEFAULT_MOSAIC_ARRANGEMENT } from '../renderer/state';

/**
 * Create a mosaic arrangement given an array of editor ids.
 *
 * @export
 * @param {Array<EditorId>} input
 * @returns {MosaicNode<EditorId>}
 */
export function createMosaicArrangement(input: Array<EditorId>): MosaicNode<EditorId> {
  if (input.length === 2) {
    return {
      direction: 'column',
      first: input[0],
      second: input[1]
    };
  }

  if (input.length === 3) {
    return DEFAULT_MOSAIC_ARRANGEMENT;
  }

  return input[0];
}

/**
 * Returns an array of visible editors given a mosaic arrangement.
 *
 * @export
 * @param {MosaicNode<EditorId> | null} input
 * @returns {Array<EditorId>}
 */
export function getVisibleEditors(input: MosaicNode<EditorId> | null): Array<EditorId> {
  // Handle the unlikely null case
  if (!input) return [];

  // Handle the case where only one editor is visible
  if (typeof input === 'string') {
    return [ input ];
  }

  // Handle the other cases (2 or 3)
  const result = [];
  for (const node of [ input.first, input.second ]) {
    if (typeof node === 'string') {
      result.push(node);
    } else {
      result.push(...getVisibleEditors(node));
    }
  }

  return result;
}
