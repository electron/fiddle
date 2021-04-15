import { DEFAULT_EDITORS, DefaultEditorId } from '../../src/interfaces';
import { DEFAULT_MOSAIC_ARRANGEMENT } from '../../src/renderer/constants';
import {
  createMosaicArrangement,
  getVisibleMosaics,
} from '../../src/utils/editors-mosaic-arrangement';

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
      const result = createMosaicArrangement(DEFAULT_EDITORS.slice(0, 4));

      expect(result).toEqual(DEFAULT_MOSAIC_ARRANGEMENT);
    });
  });

  describe('getVisibleMosaics()', () => {
    it('returns the correct array for no panels', () => {
      const result = getVisibleMosaics(null);

      expect(result).toEqual([]);
    });

    it('returns the correct array for one visible panel', () => {
      const result = getVisibleMosaics(DefaultEditorId.main);

      expect(result).toEqual([DefaultEditorId.main]);
    });

    it('returns the correct array for two visible panels', () => {
      const result = getVisibleMosaics({
        direction: 'column',
        first: DefaultEditorId.main,
        second: DefaultEditorId.renderer,
      });

      expect(result).toEqual([DefaultEditorId.main, DefaultEditorId.renderer]);
    });

    it('returns the correct array for the default mosaic', () => {
      const result = getVisibleMosaics(DEFAULT_MOSAIC_ARRANGEMENT);

      expect(result).toEqual(DEFAULT_EDITORS.slice(0, 4));
    });
  });
});
