import {
  getEmptyContent,
  getSuffix,
  isSupportedFile,
} from '../../src/utils/editor-utils';
import { createEditorValues } from '../mocks/editor-values';

describe('editor-utils', () => {
  describe('getEmptyContent', () => {
    it('returns comments for known types', () => {
      expect(getEmptyContent('main.js')).toBe('// Empty');
      expect(getEmptyContent('styles.css')).toBe('/* Empty */');
      expect(getEmptyContent('index.html')).toBe('<!-- Empty -->');
      expect(getEmptyContent('data.json')).toBe('{}');
    });

    it('returns an empty string for unknown types', () => {
      expect(getEmptyContent('main.foo')).toBe('');
    });
  });

  describe('isSupportedFile', () => {
    it('supports all default editor types', () => {
      for (const id of Object.keys(createEditorValues())) {
        expect(isSupportedFile(id)).toBe(true);
      }
    });
  });

  describe('getSuffix', () => {
    it('returns suffix for filename', () => {
      expect(getSuffix('foo.css')).toEqual('css');
    });
  });
});
