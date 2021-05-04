import { DefaultEditorId } from '../../src/interfaces';
import {
  DEFAULT_MOSAIC_ARRANGEMENT,
  SORTED_EDITORS,
} from '../../src/renderer/constants';
import { createMosaicArrangement } from '../../src/utils/editors-mosaic-arrangement';

describe('Mosaic Arrangement Utilities', () => {
  describe('createMosaicArrangement()', () => {
    it('creates the correct arrangement for one visible panel', () => {
      const result = createMosaicArrangement([DefaultEditorId.main]);

      expect(result).toEqual(DefaultEditorId.main);
    });

    it('creates the correct arrangement for two visible panels', () => {
      const result = createMosaicArrangement([
        DefaultEditorId.main,
        DefaultEditorId.renderer,
      ]);

      expect(result).toEqual({
        direction: 'row',
        first: DefaultEditorId.main,
        second: DefaultEditorId.renderer,
      });
    });

    it('creates the correct arrangement for the default visible panels', () => {
      const result = createMosaicArrangement(SORTED_EDITORS.slice(0, 4));

      expect(result).toEqual(DEFAULT_MOSAIC_ARRANGEMENT);
    });
  });
});
