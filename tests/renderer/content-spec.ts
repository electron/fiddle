import { EditorId } from '../../src/interfaces';
import { getContent, isContentUnchanged } from '../../src/renderer/content';

describe('content', () => {
  describe('getContent()', () => {
    it('returns content for HTML editor', () => {
      expect(getContent(EditorId.html)).toBeTruthy();
    });

    it('returns content for the renderer editor', () => {
      expect(getContent(EditorId.renderer)).toBeTruthy();
    });

    it('returns content for the main editor', () => {
      expect(getContent(EditorId.main)).toBeTruthy();
    });

    it('returns an empty string for an unknown request', () => {
      expect(getContent('beep' as any)).toBeTruthy();
    });
  });

  describe('isContentUnchanged()', () => {
    it('returns false if app is not available', async () => {
      (window.ElectronFiddle.app as any) = null;

      const isUnchanged = await isContentUnchanged(EditorId.main);
      expect(isUnchanged).toBe(false);
    });

    describe(EditorId.main, () => {
      it('returns false if it changed', async () => {
        (window.ElectronFiddle.app.getEditorValues as jest.Mock<
          any
        >).mockReturnValueOnce({
          main: 'hi'
        });

        const isUnchanged = await isContentUnchanged(EditorId.main);
        expect(isUnchanged).toBe(false);
      });

      it('returns true if it did not change', async () => {
        (window.ElectronFiddle.app.getEditorValues as jest.Mock<
          any
        >).mockReturnValueOnce({
          main: require('../../src/content/main').main
        });

        const isUnchanged = await isContentUnchanged(EditorId.main);
        expect(isUnchanged).toBe(true);
      });

      it('returns true if it did not change (1.0 version)', async () => {
        (window.ElectronFiddle.app.getEditorValues as jest.Mock<
          any
        >).mockReturnValueOnce({
          main: require('../../src/content/main-1-x-x').main
        });

        const isUnchanged = await isContentUnchanged(EditorId.main);
        expect(isUnchanged).toBe(true);
      });
    });

    describe(EditorId.renderer, () => {
      it('returns false if it changed', async () => {
        (window.ElectronFiddle.app.getEditorValues as jest.Mock<
          any
        >).mockReturnValueOnce({
          renderer: 'hi'
        });

        const isUnchanged = await isContentUnchanged(EditorId.renderer);
        expect(isUnchanged).toBe(false);
      });

      it('returns true if it did not change', async () => {
        (window.ElectronFiddle.app.getEditorValues as jest.Mock<
          any
        >).mockReturnValueOnce({
          renderer: require('../../src/content/renderer').renderer
        });

        const isUnchanged = await isContentUnchanged(EditorId.renderer);
        expect(isUnchanged).toBe(true);
      });
    });
  });
});
