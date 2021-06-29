import * as fs from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import { Response } from 'cross-fetch';

let fakeUserData: tmp.DirResult | null;

import { DefaultEditorId } from '../../src/interfaces';
import { getTemplate, getTestTemplate } from '../../src/renderer/content';

jest.unmock('fs-extra');
jest.mock('../../src/renderer/constants', () => {
  // when USER_DATA_PATH is imported,
  // set it to be a newly-allocated tmpdir
  if (!fakeUserData) {
    tmp.setGracefulCleanup();
    fakeUserData = tmp.dirSync({
      template: 'electron-fiddle-tests--user-data-XXXXXX',
      unsafeCleanup: true, // remove everything
    });
  }
  return {
    USER_DATA_PATH: fakeUserData.name,
  };
});

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

  afterEach(() => {
    if (fakeUserData) {
      fakeUserData.removeCallback();
      fakeUserData = null;
    }
  });

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

  describe('getTempalte()', () => {
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

    it.each([
      DefaultEditorId.html,
      DefaultEditorId.renderer,
      DefaultEditorId.main,
    ])('returns content for %p', async (id) => {
      const version = VERSION_IN_FIXTURES;
      const values = await getTemplate(version);
      expect(values[id]).toBeTruthy();
    });

    it('returns fallback content for an unparsable version', async () => {
      const version = 'beep';
      const values = await getTemplate(version);
      expect(values[DefaultEditorId.main]).toBeTruthy();
    });

    it('returns fallback content for an non-existent version', async () => {
      const version = '999.0.0-beta.1';
      const values = await getTemplate(version);
      expect(values[DefaultEditorId.main]).toBeTruthy();
    });

    it('downloads and returns content for known versions', async () => {
      const version = VERSION_IN_FIXTURES;
      const values = await getTemplate(version);
      expect(lastResponse).toMatchObject({ status: 200 });
      expect(values[DefaultEditorId.html]).toMatch(/^<!DOCTYPE html>/);
    });

    it('provides fallback content if downloads fail', async () => {
      const version = VERSION_NOT_IN_FIXTURES;
      const content = await getTemplate(version);
      expect(lastResponse).toMatchObject({ status: 404 });
      expect(content[DefaultEditorId.html]).toMatch(/^<!DOCTYPE html>/);
    });

    it('returns the same content when called multiple times', async () => {
      const curVer = VERSION_IN_FIXTURES;
      const expected = await getTemplate(curVer);

      const numTries = 3;
      for (let i = 0; i < numTries; ++i) {
        expect(await getTemplate(curVer)).toEqual(expected);
      }
    });
  });
});
