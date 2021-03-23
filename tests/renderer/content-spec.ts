import * as fs from 'fs-extra';
import * as path from 'path';
import { Response } from 'cross-fetch';

import { EditorId } from '../../src/interfaces';
import {
  getContent,
  getTemplate,
  getTestTemplate,
  isContentUnchanged,
} from '../../src/renderer/content';

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
  const VERSION_IN_FIXTURES = '11.0.0';
  const VERSION_NOT_IN_FIXTURES = '10.0.0';

  describe('getTestTemplate()', () => {
    beforeEach(() => {
      // @ts-ignore: force 'any'; fetch's param type is private / inaccessible
      jest.spyOn(global, 'fetch').mockImplementation(fetchFromFilesystem);
    });

    afterEach(() => {
      (global.fetch as jest.Mock).mockClear();
    });

    it('loads a test template', async () => {
      await getTestTemplate();
      expect(global.fetch as jest.Mock).toHaveBeenCalledTimes(1);
      expect(global.fetch as jest.Mock).toHaveBeenLastCalledWith(
        'https://github.com/electron/electron-quick-start/archive/test-template.zip',
      );
    });
  });

  describe('getContent()', () => {
    beforeEach(() => {
      // @ts-ignore: force 'any'; fetch's param type is private / inaccessible
      jest.spyOn(global, 'fetch').mockImplementation(fetchFromFilesystem);
    });
    afterEach(() => {
      (global.fetch as jest.Mock).mockClear();
    });

    it('returns content for HTML editor', async () => {
      const curVer = VERSION_IN_FIXTURES;
      expect(await getContent(EditorId.html, curVer)).toBeTruthy();
    });

    it('returns content for the renderer editor', async () => {
      const curVer = VERSION_IN_FIXTURES;
      expect(await getContent(EditorId.renderer, curVer)).toBeTruthy();
    });

    it('returns content for the main editor', async () => {
      const curVer = VERSION_IN_FIXTURES;
      expect(await getContent(EditorId.main, curVer)).toBeTruthy();
    });

    it('returns fallback content for an unparsable version', async () => {
      expect(await getContent(EditorId.main, 'beep')).toBeTruthy();
    });

    it('returns fallback content for an non-existent version', async () => {
      expect(await getContent(EditorId.main, '999.0.0-beta.1')).toBeTruthy();
    });

    it('downloads and returns content for known versions', async () => {
      const content = await getContent(EditorId.html, VERSION_IN_FIXTURES);
      expect(lastResponse).toMatchObject({ status: 200 });
      expect(content).toMatch(/^<!DOCTYPE html>/);
    });

    it('provides fallback content if downloads fail', async () => {
      const content = await getContent(EditorId.html, VERSION_NOT_IN_FIXTURES);
      expect(lastResponse).toMatchObject({ status: 404 });
      expect(content).toMatch(/^<!DOCTYPE html>/);
    });

    it('returns the same content when called multiple times', async () => {
      const curVer = VERSION_IN_FIXTURES;
      const id = EditorId.main;
      const expected = await getContent(id, curVer);

      const numTries = 3;
      for (let i = 0; i < numTries; ++i) {
        const content = await getContent(id, curVer);
        expect(content).toEqual(expected);
      }
    });
  });

  describe('getTemplate()', () => {
    beforeEach(() => {
      // @ts-ignore: force 'any'; fetch's param type is private / inaccessible
      jest.spyOn(global, 'fetch').mockImplementation(fetchFromFilesystem);
    });
    afterEach(() => {
      (global.fetch as jest.Mock).mockClear();
    });

    it('returns the same promise if the work is already pending', async () => {
      const prom1 = getTemplate(VERSION_IN_FIXTURES);
      const prom2 = getTemplate(VERSION_IN_FIXTURES);
      expect(prom1).toEqual(prom2);
    });
  });

  describe('isContentUnchanged()', () => {
    const curVer = VERSION_IN_FIXTURES;

    it('returns false if app is not available', async () => {
      (window.ElectronFiddle.app as any) = null;
      const isUnchanged = await isContentUnchanged(EditorId.main, curVer);
      expect(isUnchanged).toBe(false);
    });

    describe(EditorId.main, () => {
      it('returns false if it changed', async () => {
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          main: 'hi',
        });

        const isUnchanged = await isContentUnchanged(EditorId.main, curVer);
        expect(isUnchanged).toBe(false);
      });

      it('returns true if it did not change', async () => {
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          main: await getContent(EditorId.main, curVer),
        });

        const isUnchanged = await isContentUnchanged(EditorId.main, curVer);
        expect(isUnchanged).toBe(true);
      });
    });

    describe(EditorId.renderer, () => {
      it('returns false if it changed', async () => {
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          renderer: 'hi',
        });

        const isUnchanged = await isContentUnchanged(EditorId.renderer, curVer);
        expect(isUnchanged).toBe(false);
      });

      it('returns true if it did not change', async () => {
        (window.ElectronFiddle.app
          .getEditorValues as jest.Mock<any>).mockReturnValueOnce({
          renderer: await getContent(EditorId.renderer, curVer),
        });

        const isUnchanged = await isContentUnchanged(EditorId.renderer, curVer);
        expect(isUnchanged).toBe(true);
      });
    });
  });
});
