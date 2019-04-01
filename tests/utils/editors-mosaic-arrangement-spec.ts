import { ALL_EDITORS, EditorId } from '../../src/interfaces';
import { DEFAULT_MOSAIC_ARRANGEMENT } from '../../src/renderer/constants';
import { createMosaicArrangement, getVisibleEditors } from '../../src/utils/editors-mosaic-arrangement';

describe('Mosaic Arrangement Utilities', () => {
  describe('createMosaicArrangement()', () => {
    it('creates the correct arrangement for one visible panel', () => {
      const result = createMosaicArrangement([ EditorId.main ]);

      expect(result).toEqual(EditorId.main);
    });

    it('creates the correct arrangement for two visible panels', () => {
      const result = createMosaicArrangement([ EditorId.main, EditorId.renderer ]);

      expect(result).toEqual({
        direction: 'column',
        first: EditorId.main,
        second: EditorId.renderer
      });
    });

    it('creates the correct arrangement for three visible panels', () => {
      const result = createMosaicArrangement([ EditorId.main, EditorId.renderer, EditorId.html ]);

      expect(result).toEqual(DEFAULT_MOSAIC_ARRANGEMENT);
    });
  });

  describe('getVisibleEditors()', () => {
    it('returns the correct array for no panels', () => {
      const result = getVisibleEditors(null);

      expect(result).toEqual([]);
    });

    it('returns the correct array for one visible panel', () => {
      const result = getVisibleEditors(EditorId.main);

      expect(result).toEqual([ EditorId.main ]);
    });

    it('returns the correct array for two visible panels', () => {
      const result = getVisibleEditors({
        direction: 'column',
        first: EditorId.main,
        second: EditorId.renderer
      });

      expect(result).toEqual([ EditorId.main, EditorId.renderer ]);
    });

    it('returns the correct array for three visible panels', () => {
      const result = getVisibleEditors(DEFAULT_MOSAIC_ARRANGEMENT);

      expect(result).toEqual(ALL_EDITORS);
    });
  });
});
