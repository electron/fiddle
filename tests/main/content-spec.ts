import * as path from 'node:path';

import { app } from 'electron';
import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';
import * as tmp from 'tmp';

let fakeUserData: tmp.DirResult | null;

import { EditorValues, MAIN_JS } from '../../src/interfaces';
import { getTemplate, getTestTemplate } from '../../src/main/content';
import { isReleasedMajor } from '../../src/main/versions';

jest.unmock('fs-extra');
jest.mock('../../src/main/constants', () => ({
  STATIC_DIR: path.join(__dirname, '../../static'),
}));
jest.mock('../../src/main/versions', () => ({
  isReleasedMajor: jest.fn(),
}));

// instead of downloading fixtures,
// pull the files from tests/fixtures/templates/
const fetchFromFilesystem = async (url: string) => {
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
  return {
    arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
    ok: true,
    status,
    statusText,
  } as unknown as Response;
};

describe('content', () => {
  const VERSION_IN_FIXTURES = '11.0.0';
  const VERSION_NOT_IN_FIXTURES = '10.0.0';

  beforeAll(() => {
    mocked(app.getPath).mockImplementation((name: string) => {
      if (name === 'userData') {
        // set it to be a newly-allocated tmpdir
        if (!fakeUserData) {
          tmp.setGracefulCleanup();
          fakeUserData = tmp.dirSync({
            template: 'electron-fiddle-tests--user-data-XXXXXX',
            unsafeCleanup: true, // remove everything
          });
        }
      }

      return '';
    });
  });

  afterEach(() => {
    if (fakeUserData) {
      fakeUserData.removeCallback();
      fakeUserData = null;
    }
  });

  describe('getTestTemplate()', () => {
    beforeEach(() => {
      mocked(fetch).mockImplementation(fetchFromFilesystem);
    });

    afterEach(() => {
      mocked(fetch).mockClear();
    });

    it('loads a test template', async () => {
      await getTestTemplate();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenLastCalledWith(
        'https://github.com/electron/electron-quick-start/archive/test-template.zip',
      );
    });
  });

  describe('getTemplate()', () => {
    beforeEach(() => {
      mocked(fetch).mockImplementation(fetchFromFilesystem);
    });
    afterEach(() => {
      mocked(fetch).mockClear();
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

    it('returns the same promise if the work is already pending', async () => {
      mocked(isReleasedMajor).mockReturnValue(true);
      const version = VERSION_IN_FIXTURES;
      const a = getTemplate(version);
      const b = getTemplate(version);
      expect(a).toBe(b);
      await Promise.all([a, b]);
    });
  });
});
