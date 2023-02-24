import * as fs from 'fs';
import * as path from 'path';

import * as semver from 'semver';

import {
  ElectronReleaseChannel,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import {
  VersionKeys,
  addLocalVersion,
  fetchVersions,
  getDefaultVersion,
  getElectronVersions,
  getLocalVersions,
  getOldestSupportedMajor,
  getReleaseChannel,
  isReleasedMajor,
  saveLocalVersions,
} from '../../src/renderer/versions';
import { FetchMock } from '../utils';

const mockVersions: Array<Partial<RunnableVersion>> = [
  { version: 'test-0', localPath: '/test/path/0' },
  { version: 'test-1', localPath: '/test/path/1' },
  { version: 'test-2', localPath: '/test/path/2' },
];

describe('versions', () => {
  describe('getDefaultVersion()', () => {
    it('handles a stored version', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('2.0.2');
      const output = getDefaultVersion([{ version: '2.0.2' }] as any);
      expect(output).toBe('2.0.2');
    });

    it('uses the newest stable as a fallback', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);
      const output = getDefaultVersion([
        { version: '11.0.0' },
        { version: '15.0.0-nightly.20210715' },
        { version: '13.0.0' },
        { version: '15.0.0-alpha.1' },
        { version: '12.0.0' },
        { version: '14.0.0-beta.1' },
      ] as any);
      expect(output).toBe('13.0.0');
    });

    it('throws if everything goes wrong', () => {
      expect(() => getDefaultVersion([])).toThrow();
    });
  });

  describe('getReleaseChannel()', () => {
    it('identifies a nightly release', () => {
      expect(
        getReleaseChannel({
          version: 'v4.0.0-nightly.20180817',
        } as any),
      ).toBe(ElectronReleaseChannel.nightly);
    });

    it('identifies a beta release', () => {
      expect(
        getReleaseChannel({
          version: 'v3.0.0-beta.4',
        } as any),
      ).toBe(ElectronReleaseChannel.beta);
    });

    it('identifies a stable release', () => {
      expect(
        getReleaseChannel({
          version: 'v3.0.0',
        } as any),
      ).toBe(ElectronReleaseChannel.stable);
    });

    it('identifies an unknown release as stable', () => {
      expect(getReleaseChannel({} as any)).toBe(ElectronReleaseChannel.stable);
    });
  });

  describe('addLocalVersion()', () => {
    beforeEach(() => {
      (window.localStorage.getItem as jest.Mock).mockReturnValue(
        JSON.stringify([mockVersions[0]]),
      );
    });

    it('adds a local version', () => {
      expect(addLocalVersion(mockVersions[1] as any)).toEqual([
        mockVersions[0],
        mockVersions[1],
      ]);
    });

    it('does not add duplicates', () => {
      expect(addLocalVersion(mockVersions[0] as any)).toEqual([
        mockVersions[0],
      ]);
    });
  });

  describe('saveLocalVersions()', () => {
    it('saves local versions', () => {
      const mockLocalVersions = mockVersions.map((v) => {
        v.source = VersionSource.local;
        return v;
      });

      saveLocalVersions(mockLocalVersions as Array<RunnableVersion>);

      const key = (window.localStorage.setItem as jest.Mock).mock.calls[0][0];
      const value = (window.localStorage.setItem as jest.Mock).mock.calls[0][1];

      expect(key).toBe(VersionKeys.local);
      expect(value).toBe(JSON.stringify(mockLocalVersions));
    });
  });

  describe('getLocalVersions', () => {
    it('returns an empty array if none can be found', () => {
      expect(getLocalVersions()).toEqual([]);
    });

    it('migrates an old format if necessary', () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValueOnce(
        `
        [{
          "url": "/Users/felixr/Code/electron/src/out/Debug",
          "assets_url": "/Users/felixr/Code/electron/src/out/Debug",
          "body": "Local version, added at 1538771049442",
          "created_at": "1538771049442",
          "name": "src/out/Debug 4.0.0",
          "html_url": "",
          "prerelease": true,
          "published_at": "1538771049442",
          "tag_name": "4.0.0",
          "target_commitish": ""
        }, { "garbage": "true" }]
      `.trim(),
      );

      expect(getLocalVersions()).toEqual([
        {
          localPath: '/Users/felixr/Code/electron/src/out/Debug',
          version: '4.0.0',
          name: 'src/out/Debug 4.0.0',
        },
      ]);
    });
  });

  describe('fetchVersions()', () => {
    it('fetches versions >= 0.24.0', async () => {
      const fetchMock = new FetchMock();
      const url = 'https://releases.electronjs.org/releases.json';
      const filename = path.join(__dirname, '../mocks/versions-mock.json');
      const contents = fs.readFileSync(filename).toString();
      fetchMock.add(url, contents);

      const result = await fetchVersions();
      const expected = [
        { version: '10.0.0-nightly.20200303' },
        { version: '9.0.0-beta.5' },
        { version: '4.2.0' },
      ];

      expect(result).toEqual(expected);
      expect(window.localStorage.setItem as jest.Mock).toHaveBeenCalled();
    });

    it('fetches versions < 0.24.0', async () => {
      const fetchMock = new FetchMock();
      const url = 'https://releases.electronjs.org/releases.json';
      fetchMock.add(
        url,
        JSON.stringify([
          {
            version: '0.23.0',
          },
        ]),
      );

      const result = await fetchVersions();

      expect(result).toHaveLength(0);
    });
  });

  describe('getOldestSupportedMajor()', () => {
    it('uses localStorage versions if available', () => {
      // inject versions into localstorage
      (window.localStorage.getItem as jest.Mock).mockReturnValueOnce(
        `[
          { "version": "10.0.0" },
          { "version": "9.0.0" },
          { "version": "8.0.0" },
          { "version": "7.0.0" },
          { "version": "6.0.0" }
        ]`,
      );
      expect(getOldestSupportedMajor()).toEqual(7);
    });

    function getExpectedOldestSupportedVersion() {
      const versions = getElectronVersions();
      const major = semver.parse(getDefaultVersion(versions))!.major;
      const NUM_BRANCHES = parseInt(process.env.NUM_STABLE_BRANCHES || '') || 4;
      return major + 1 - NUM_BRANCHES;
    }

    it('falls back to a local require', () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValueOnce('garbage');

      const expected = getExpectedOldestSupportedVersion();
      expect(getOldestSupportedMajor()).toBe(expected);
    });

    it('falls back to a local require', () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValueOnce(
        `[{ "garbage": "true" }]`,
      );

      const expected = getExpectedOldestSupportedVersion();
      expect(getOldestSupportedMajor()).toBe(expected);
    });

    it('honors process.env.NUM_STABLE_BRANCHES', () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValueOnce('garbage');

      process.env.NUM_STABLE_BRANCHES = '2';
      const expected = getExpectedOldestSupportedVersion();
      expect(getOldestSupportedMajor()).toBe(expected);
    });
  });

  describe('isReleasedMajor()', () => {
    it('returns true for recognized releases', () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValueOnce(
        `[{ "version": "3.0.5" }]`,
      );
      expect(isReleasedMajor(3)).toBe(true);
    });

    it('returns false for unrecognized releases', () => {
      (window.localStorage.getItem as jest.Mock).mockReturnValueOnce(
        `[{ "version": "3.0.5" }]`,
      );
      expect(isReleasedMajor(1000)).toBe(false);
    });
  });
});
