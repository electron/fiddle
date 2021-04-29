import * as fs from 'fs';
import * as path from 'path';
import {
  ElectronReleaseChannel,
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../src/interfaces';
import { getVersionState } from '../../src/renderer/binary';
import {
  addLocalVersion,
  fetchVersions,
  getDefaultVersion,
  getKnownVersions,
  getLocalVersions,
  getReleaseChannel,
  getUpdatedElectronVersions,
  saveLocalVersions,
  VersionKeys,
} from '../../src/renderer/versions';
import { FetchMock } from '../utils';

jest.mock('../../src/renderer/binary', () => ({
  getVersionState: jest
    .fn()
    .mockImplementation((v: RunnableVersion) => v.state),
}));

const { expectedVersionCount } = require('../fixtures/releases-metadata.json');

const mockVersions: Array<Partial<RunnableVersion>> = [
  { version: 'test-0', localPath: '/test/path/0' },
  { version: 'test-1', localPath: '/test/path/1' },
  { version: 'test-2', localPath: '/test/path/2' },
];

describe('versions', () => {
  describe('getDefaultVersion()', () => {
    it('handles a stored version', () => {
      (localStorage.getItem as any).mockReturnValue('2.0.2');
      const output = getDefaultVersion([{ version: '2.0.2' }] as any);
      expect(output).toBe('2.0.2');
    });

    it('handles a v-prefixed version', () => {
      (localStorage.getItem as any).mockReturnValue('v2.0.2');
      const output = getDefaultVersion([{ version: '2.0.2' }] as any);
      expect(output).toBe('2.0.2');
    });

    it('handles garbage data', () => {
      (localStorage.getItem as any).mockReturnValue('v3.0.0');
      const output = getDefaultVersion([{ version: '2.0.2' }] as any);
      expect(output).toBe('2.0.2');
    });

    it('handles if no version is set', () => {
      (localStorage.getItem as any).mockReturnValue(null);
      const output = getDefaultVersion([{ version: '2.0.2' }] as any);
      expect(output).toBe('2.0.2');
    });

    it('throws if everything goes wrong', () => {
      const testFn = () => {
        return getDefaultVersion(null as any);
      };

      expect(testFn).toThrow();
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
      (window.localStorage.getItem as jest.Mock<any>).mockReturnValue(
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
      (window as any).localStorage.getItem.mockReturnValueOnce(
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
      const url = 'https://unpkg.com/electron-releases/lite.json';
      const filename = path.join(__dirname, '../mocks/unpkg-mock.json');
      const contents = fs.readFileSync(filename).toString();
      fetchMock.add(url, contents);

      const result = await fetchVersions();
      const expected = [
        { version: '10.0.0-nightly.20200303' },
        { version: '9.0.0-beta.5' },
        { version: '4.2.0' },
      ];

      expect(result).toEqual(expected);
      expect(window.localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getKnownVersions()', () => {
    it('tries to get versions from localStorage', () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(
        `[{ "version": "3.0.5" }]`,
      );

      expect(getKnownVersions()).toEqual([{ version: '3.0.5' }]);
    });

    it('falls back to a local require', () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(`garbage`);

      expect(getKnownVersions().length).toBe(expectedVersionCount);
    });

    it('falls back to a local require', () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(
        `[{ "garbage": "true" }]`,
      );

      expect(getKnownVersions().length).toBe(expectedVersionCount);
    });
  });

  describe('getUpdatedElectronVersions()', () => {
    it('gets known versions', async () => {
      (getVersionState as jest.Mock).mockImplementation((v: any) => {
        if (v.version === '3.0.5') return VersionState.ready;
        if (v.version === '3.0.6') return VersionState.unknown;
        return v.state;
      });

      (window as any).localStorage.getItem.mockImplementation((key: string) => {
        if (key === 'known-electron-versions')
          return '[{ "version": "3.0.5" }]';
        if (key === 'local-electron-versions')
          return '[{ "version": "3.0.6" }]';
        throw new Error(`unexpected key ${key}`);
      });

      const fetchMock = new FetchMock();
      fetchMock.add('getUpdatedElectronVersions', '');
      const result = await getUpdatedElectronVersions();

      expect(result).toEqual([
        {
          source: VersionSource.remote,
          state: VersionState.ready,
          version: '3.0.5',
        },
        {
          source: VersionSource.local,
          state: VersionState.unknown,
          version: '3.0.6',
        },
      ]);
    });
  });
});
