import { DEFAULT_EDITORS, DefaultEditorId } from '../../src/interfaces';
import {
  getEditorTitle,
  getEmptyContent,
  isKnownFile,
  isSupportedFile,
} from '../../src/utils/editor-utils';

describe('editor-utils', () => {
  describe('getEditorTitle', () => {
    it('recognizes default titles', () => {
      expect(getEditorTitle(DefaultEditorId.main)).toBe(
        'Main Process (main.js)',
      );
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
});
