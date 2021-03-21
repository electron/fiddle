import * as fs from 'fs-extra';
import * as path from 'path';
import { Response } from 'cross-fetch';

import { EditorId } from '../../src/interfaces';
import { getContent, isContentUnchanged } from '../../src/renderer/content';

jest.unmock('fs-extra');

let lastResponse = new Response(null, {
  status: 503,
  statusText: 'Service Unavailable',
});

// instead of downloading fixtures,
// pull the files from tests/fixtures/templates/
const fetchFromFilesystem = (url: string) => {
  let arrayBuffer = null;
  let status = 404;
  let statusText = 'Not Found';
  try {
    const filename = path.join(
      __dirname,
      '../fixtures/templates',
      path.basename(new URL(url).pathname),
    );
    console.log(`Fetching ${url} from ${filename}`);
    const opts = { encoding: null };
    const buffer = fs.readFileSync(filename, opts);
    arrayBuffer = Uint8Array.from(buffer).buffer;
    status = 200;
    statusText = 'OK';
  } catch (err) {
    console.log(err);
  }
  lastResponse = new Response(arrayBuffer, { status, statusText });
  return Promise.resolve(lastResponse);
};

describe('content', () => {
  describe('getContent()', () => {
    beforeEach(() => {
      // @ts-ignore: force 'any'; fetch's param type is private / inaccessible
      jest.spyOn(global, 'fetch').mockImplementation(fetchFromFilesystem);
    });
    afterEach(() => {
      (global.fetch as jest.Mock).mockClear();
    });

    it('returns content for HTML editor', async () => {
      expect(await getContent(EditorId.html)).toBeTruthy();
    });

    it('returns content for the renderer editor', async () => {
      expect(await getContent(EditorId.renderer)).toBeTruthy();
    });

    it('returns content for the main editor', async () => {
      expect(await getContent(EditorId.main)).toBeTruthy();
    });

    it('returns fallback content for an unparsable version', async () => {
      expect(await getContent(EditorId.main, 'beep')).toBeTruthy();
    });

    it('returns fallback content for an non-existent version', async () => {
      expect(await getContent(EditorId.main, '999.0.0-beta.1')).toBeTruthy();
    });

    it('downloads and returns content for known versions', async () => {
      const content = await getContent(EditorId.html, '11.0.0');
      expect(lastResponse).toMatchObject({ status: 200 });
      expect(content).toMatch(/^<!DOCTYPE html>/);
    });

    it('provides fallback content if downloads fail', async () => {
      const VERSION_NOT_IN_FIXTURES = '10.0.0';
      const content = await getContent(EditorId.html, VERSION_NOT_IN_FIXTURES);
      expect(lastResponse).toMatchObject({ status: 404 });
      expect(content).toMatch(/^<!DOCTYPE html>/);
    });

    it('returns the same content when called multiple times', async () => {
      const id = EditorId.main;
      const numTries = 3;
      const expected = await getContent(id);
      for (let i = 0; i < numTries; ++i) {
        const content = await getContent(EditorId.main);
        expect(content).toEqual(expected);
      }
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
