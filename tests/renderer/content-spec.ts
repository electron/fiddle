import { EditorId } from '../../src/interfaces';
import { getContent, isContentUnchanged } from '../../src/renderer/content';

jest.unmock('fs-extra');

describe('content', () => {
  describe('getContent()', () => {
    it('returns content for HTML editor', async () => {
      const content = await getContent(EditorId.html);
      expect(content).toBeTruthy();
    });

    it('returns content for the renderer editor', async () => {
      const content = await getContent(EditorId.renderer);
      expect(content).toBeTruthy();
    });

    it('returns content for the main editor', async () => {
      const content = await getContent(EditorId.main);
      expect(content).toBeTruthy();
    });

    it('returns fallback content for an unparsable version', async () => {
      const content = await getContent(EditorId.main, 'beep');
      expect(content).toBeTruthy();
    });

    it('returns fallback content for an non-existent version', async () => {
      const content = await getContent(EditorId.main, '999.0.0-beta.1');
      expect(content).toBeTruthy();
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
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          main: 'hi',
        });

        const isUnchanged = await isContentUnchanged(EditorId.main);
        expect(isUnchanged).toBe(false);
      });

      it('returns true if it did not change', async () => {
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          main: await getContent(EditorId.main),
        });

        const isUnchanged = await isContentUnchanged(EditorId.main);
        expect(isUnchanged).toBe(true);
      });

      it('returns true if it did not change (1.0 version)', async () => {
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          main: await getContent(EditorId.main, '1-x-y'),
        });

        const isUnchanged = await isContentUnchanged(EditorId.main);
        expect(isUnchanged).toBe(true);
      });
    });

    describe(EditorId.renderer, () => {
      it('returns false if it changed', async () => {
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          renderer: 'hi',
        });

        const isUnchanged = await isContentUnchanged(EditorId.renderer);
        expect(isUnchanged).toBe(false);
      });

      it('returns true if it did not change', async () => {
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          renderer: await getContent(EditorId.renderer),
        });

        const isUnchanged = await isContentUnchanged(EditorId.renderer);
        expect(isUnchanged).toBe(true);
      });
    });
  });
});
