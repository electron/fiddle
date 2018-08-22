import { ContentNames, getContent, isContentUnchanged } from '../../src/renderer/content';

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

  describe('isContentUnchanged()', () => {
    describe('main', () => {
      it('returns false if it changed', async () => {
        window.ElectronFiddle.app.getValues.mockReturnValueOnce({
          main: 'hi'
        });

        const isUnchanged = await isContentUnchanged(ContentNames.MAIN);
        expect(isUnchanged).toBe(false);
      });

      it('returns true if it did not change', async () => {
        window.ElectronFiddle.app.getValues.mockReturnValueOnce({
          main: require('../../src/content/main').main
        });

        const isUnchanged = await isContentUnchanged(ContentNames.MAIN);
        expect(isUnchanged).toBe(true);
      });

      it('returns true if it did not change (1.0 version)', async () => {
        window.ElectronFiddle.app.getValues.mockReturnValueOnce({
          main: require('../../src/content/main-1-x-x').main
        });

        const isUnchanged = await isContentUnchanged(ContentNames.MAIN);
        expect(isUnchanged).toBe(true);
      });
    });

    describe('renderer', () => {
      it('returns false if it changed', async () => {
        window.ElectronFiddle.app.getValues.mockReturnValueOnce({
          renderer: 'hi'
        });

        const isUnchanged = await isContentUnchanged(ContentNames.RENDERER);
        expect(isUnchanged).toBe(false);
      });

      it('returns true if it did not change', async () => {
        window.ElectronFiddle.app.getValues.mockReturnValueOnce({
          renderer: require('../../src/content/renderer').renderer
        });

        const isUnchanged = await isContentUnchanged(ContentNames.RENDERER);
        expect(isUnchanged).toBe(true);
      });
    });
  });
});
