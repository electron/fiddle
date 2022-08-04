import * as path from 'path';

import { Response } from 'cross-fetch';
import * as fs from 'fs-extra';
import * as tmp from 'tmp';

let fakeUserData: tmp.DirResult | null;

import { EditorValues, MAIN_JS } from '../../src/interfaces';
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

    function expectSaneContent(values: EditorValues) {
      expect(values[MAIN_JS]).toMatch('app.whenReady');
    }

    it('returns content', async () => {
      const version = VERSION_IN_FIXTURES;
      expectSaneContent(await getTemplate(version));
    });

    it('returns fallback content for an unparsable version', async () => {
      const version = 'beep';
      expectSaneContent(await getTemplate(version));
    });

    it('returns fallback content for an non-existent version', async () => {
      const version = '999.0.0-beta.1';
      expectSaneContent(await getTemplate(version));
    });

    it('provides fallback content if downloads fail', async () => {
      const version = VERSION_NOT_IN_FIXTURES;
      expectSaneContent(await getTemplate(version));
    });

    it('returns the same content when called multiple times', async () => {
      const curVer = VERSION_IN_FIXTURES;
      const expected = await getTemplate(curVer);

      const numTries = 3;
      for (let i = 0; i < numTries; ++i) {
        expect(await getTemplate(curVer)).toEqual(expected);
      }
    });

    it('returns the same promise if the work is already pending', () => {
      const version = VERSION_IN_FIXTURES;
      const a = getTemplate(version);
      const b = getTemplate(version);
      expect(a).toBe(b);
    });
  });
});
