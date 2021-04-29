import { DEFAULT_EDITORS, MAIN_JS } from '../../src/interfaces';
import {
  compareEditors,
  getEditorTitle,
  getEmptyContent,
  isKnownFile,
  isSupportedFile,
} from '../../src/utils/editor-utils';

describe('editor-utils', () => {
  describe('getEditorTitle', () => {
    it('recognizes default titles', () => {
      expect(getEditorTitle(MAIN_JS)).toBe('Main Process (main.js)');
    });
    it('recognizes custom titles', () => {
      expect(getEditorTitle('foo.js')).toBe('Custom Editor (foo.js)');
    });
  });

  describe('getEmptyContent', () => {
    it('returns comments for known types', () => {
      expect(getEmptyContent('main.js')).toBe('// Empty');
    });
    it('returns an empty string for unknown types', () => {
      expect(getEmptyContent('main.foo')).toBe('');
    });
  });

  describe('isKnownFile', () => {
    it('marks default editors as known files', () => {
      for (const id of DEFAULT_EDITORS) {
        expect(isKnownFile(id)).toBe(true);
      }
    });
  });

  describe('isSupportedFile', () => {
    it('supports all default editor types', () => {
      for (const id of DEFAULT_EDITORS) {
        expect(isSupportedFile(id)).toBe(true);
      }
    });
  });

  describe('compareEditors', () => {
    it('sorts known files in a consistent order', () => {
      const ids = [...DEFAULT_EDITORS];
      const sorted1 = [...ids].sort(compareEditors);
      ids.push(ids.shift()!);
      ids.push(ids.shift()!);
      const sorted2 = [...ids].sort(compareEditors);
      expect(sorted1).toStrictEqual(sorted2);
    });

    it('sorts known editors before supported ones', () => {
      const filename = 'hello.js';

      let ids = [MAIN_JS, filename];
      ids.sort(compareEditors);
      expect(ids).toStrictEqual([MAIN_JS, filename]);

      ids = [filename, MAIN_JS];
      ids.sort(compareEditors);
      expect(ids).toStrictEqual([MAIN_JS, filename]);
    });

    it('sorts supported files lexicographically', () => {
      const expected = ['a.js', 'b.js'];

      const ids = [...expected];
      ids.sort(compareEditors);
      expect(ids).toStrictEqual(expected);

      ids.reverse();
      ids.sort(compareEditors);
      expect(ids).toStrictEqual(expected);
    });
  });
});
