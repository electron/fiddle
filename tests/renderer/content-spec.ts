import { ContentNames, getContent } from '../../src/renderer/content';

describe('content', () => {
  describe('getContent()', () => {
    it('returns content for HTML editor', () => {
      expect(getContent(ContentNames.HTML)).toBeTruthy();
    });

    it('returns content for the renderer editor', () => {
      expect(getContent(ContentNames.RENDERER)).toBeTruthy();
    });

    it('returns content for the main editor', () => {
      expect(getContent(ContentNames.MAIN)).toBeTruthy();
    });

    it('returns an empty string for an unknown request', () => {
      expect(getContent('beep' as any)).toBeTruthy();
    });
  });
});
