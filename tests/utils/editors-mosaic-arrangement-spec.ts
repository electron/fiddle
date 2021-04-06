import { EditorId } from '../../src/interfaces';
import {
  DEFAULT_MOSAIC_ARRANGEMENT,
  SORTED_EDITORS,
} from '../../src/renderer/constants';
import {
  createMosaicArrangement,
  getVisibleMosaics,
} from '../../src/utils/editors-mosaic-arrangement';

describe('Mosaic Arrangement Utilities', () => {
  describe('createMosaicArrangement()', () => {
    it('creates the correct arrangement for one visible panel', () => {
      const result = createMosaicArrangement([EditorId.main]);

      expect(result).toEqual(EditorId.main);
    });

    it('creates the correct arrangement for two visible panels', () => {
      const result = createMosaicArrangement([
        EditorId.main,
        EditorId.renderer,
      ]);

      expect(result).toEqual({
        direction: 'row',
        first: EditorId.main,
        second: EditorId.renderer,
      });
    });

    it('creates the correct arrangement for the default visible panels', () => {
      const result = createMosaicArrangement(SORTED_EDITORS.slice(0, 4));

      expect(result).toEqual(DEFAULT_MOSAIC_ARRANGEMENT);
    });
  });

  describe('getVisibleMosaics()', () => {
    it('returns the correct array for no panels', () => {
      const result = getVisibleMosaics(null);

      expect(result).toEqual([]);
    });

    it('returns the correct array for one visible panel', () => {
      const result = getVisibleMosaics(EditorId.main);

      expect(result).toEqual([EditorId.main]);
    });

    it('returns the correct array for two visible panels', () => {
      const result = getVisibleMosaics({
        direction: 'column',
        first: EditorId.main,
        second: EditorId.renderer,
      });

      expect(result).toEqual([EditorId.main, EditorId.renderer]);
    });

    it('returns the correct array for the default mosaic', () => {
      const result = getVisibleMosaics(DEFAULT_MOSAIC_ARRANGEMENT);

      expect(result).toEqual(SORTED_EDITORS.slice(0, 4));
    });
  });
});
