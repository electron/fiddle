import { isEditorBackup } from '../../src/utils/type-checks';

describe('Type checks', () => {
  describe('isEditorBackup()', () => {
    it('works', () => {
      expect(isEditorBackup(true)).toBe(false);
      expect(isEditorBackup({} as any)).toBe(true);
    });
  });
});
