import { MAIN_CJS, MAIN_JS, MAIN_MJS } from '../../../src/interfaces';
import {
  compareEditors,
  getEditorTitle,
  isKnownFile,
  isSupportedFile,
} from '../../../src/renderer/utils/editor-utils';
import { createEditorValues } from '../../mocks/editor-values';

describe('editor-utils', () => {
  describe('getEditorTitle', () => {
    it('recognizes known files', () => {
      // setup: id is a known file
      for (const id of [MAIN_CJS, MAIN_JS, MAIN_MJS] as const) {
        expect(isKnownFile(id));
        expect(isSupportedFile(id));

        expect(getEditorTitle(id)).toBe(`Main Process (${id})`);
      }
    });
    it('recognizes supported files', () => {
      // set up: id is supported but not known
      for (const id of ['foo.cjs', 'foo.js', 'foo.mjs'] as const) {
        expect(!isKnownFile(id));
        expect(isSupportedFile(id));

        expect(getEditorTitle(id)).toBe(id);
      }
    });
  });

  describe('isKnownFile', () => {
    it('marks default editors as known files', () => {
      for (const id of Object.keys(createEditorValues())) {
        expect(isKnownFile(id)).toBe(true);
      }
    });
  });

  describe('compareEditors', () => {
    it('sorts known files in a consistent order', () => {
      const ids = Object.keys(createEditorValues());
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
