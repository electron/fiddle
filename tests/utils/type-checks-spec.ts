import { DefaultEditorId } from '../../src/interfaces';
import { isEditorBackup, isEditorId } from '../../src/utils/type-checks';

describe('Type checks', () => {
  describe('isEditorId()', () => {
    it('works', () => {
      expect(isEditorId(DefaultEditorId.html, [])).toBe(true);
      expect(isEditorId('💩', [])).toBe(false);
    });
  });

  describe('isEditorBackup()', () => {
    it('works', () => {
      expect(isEditorBackup(true)).toBe(false);
      expect(isEditorBackup({} as any)).toBe(true);
    });
  });
});
