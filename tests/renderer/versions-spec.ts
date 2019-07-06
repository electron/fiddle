import * as fs from 'fs';
import * as path from 'path';
import { ElectronVersion, ElectronVersionSource } from '../../src/interfaces';
import {
  addLocalVersion,
  ElectronReleaseChannel,
  fetchVersions,
  getDefaultVersion,
  getKnownVersions,
  getLocalVersions,
  getReleaseChannel,
  getUpdatedElectronVersions,
  saveLocalVersions,
  VersionKeys
} from '../../src/renderer/versions';

const mockVersions: Array<Partial<ElectronVersion>> = [
  { version: 'test-0', localPath: '/test/path/0' },
  { version: 'test-1', localPath: '/test/path/1' },
  { version: 'test-2', localPath: '/test/path/2' },
];

describe('versions', () => {
  describe('getDefaultVersion()', () => {
    it('handles a stored version', () => {
      (localStorage.getItem as any).mockReturnValue('2.0.2');
      const output = getDefaultVersion([ { version: '2.0.2' } ] as any);
      expect(output).toBe('2.0.2');
    });

    it('handles a v-prefixed version', () => {
      (localStorage.getItem as any).mockReturnValue('v2.0.2');
      const output = getDefaultVersion([ { version: '2.0.2' } ] as any);
      expect(output).toBe('2.0.2');
    });

    it('handles garbage data', () => {
      (localStorage.getItem as any).mockReturnValue('v3.0.0');
      const output = getDefaultVersion([ { version: '2.0.2' } ] as any);
      expect(output).toBe('2.0.2');
    });

    it('handles if no version is set', () => {
      (localStorage.getItem as any).mockReturnValue(null);
      const output = getDefaultVersion([ { version: '2.0.2' } ] as any);
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
      expect(getReleaseChannel({
        version: 'v4.0.0-nightly.20180817'
      } as any)).toBe(ElectronReleaseChannel.nightly);
    });

    it('identifies a beta release', () => {
      expect(getReleaseChannel({
        version: 'v3.0.0-beta.4'
      } as any)).toBe(ElectronReleaseChannel.beta);
    });

    it('identifies an unsupported release', () => {
      expect(getReleaseChannel({
        version: 'v2.1.0-unsupported.20180809'
      } as any)).toBe(ElectronReleaseChannel.unsupported);
    });

    it('identifies a stable release', () => {
      expect(getReleaseChannel({
        version: 'v3.0.0'
      } as any)).toBe(ElectronReleaseChannel.stable);
    });

    it('identifies an unknown release as stable', () => {
      expect(getReleaseChannel({} as any)).toBe(ElectronReleaseChannel.stable);
    });
  });

  describe('addLocalVersion()', () => {
    beforeEach(() => {
      (window.localStorage.getItem as jest.Mock<any>).mockReturnValue(
        JSON.stringify([mockVersions[0]])
      );
    });

    it('adds a local version', () => {
      expect(addLocalVersion(mockVersions[1] as any)).toEqual([ mockVersions[0], mockVersions[1] ]);
    });

    it('does not add duplicates', () => {
      expect(addLocalVersion(mockVersions[0] as any)).toEqual([ mockVersions[0] ]);
    });
  });

  describe('saveLocalVersions()', () => {
    it('saves local versions', () => {
      const mockLocalVersions = mockVersions.map((v) => {
        v.source = ElectronVersionSource.local;
        return v;
      });

      saveLocalVersions(mockLocalVersions as Array<ElectronVersion>);

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
      (window as any).localStorage.getItem.mockReturnValueOnce(`
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
      `.trim());

      expect(getLocalVersions()).toEqual([{
        localPath: '/Users/felixr/Code/electron/src/out/Debug',
        version: '4.0.0',
        name: 'src/out/Debug 4.0.0'
      }]);
    });
  });

  describe('fetchVersions()', () => {
    const mockResponseMain = fs.readFileSync(path.join(__dirname, '../mocks/npm-response-main.json'));
    const mockResponseNightlies = fs.readFileSync(path.join(__dirname, '../mocks/npm-response-nightlies.json'));

    it('fetches versions', async () => {
      (fetch as any).mockResponses([mockResponseMain], [mockResponseNightlies]);

      const result = await fetchVersions();
      const expected = [
        { version: '3.0.1' },
        { version: '3.0.2' },
        { version: '4.0.0-nightly.20181006' },
        { version: '7.0.0-nightly.20190529' },
        { version: '7.0.0-nightly.20190704' }
      ];

      expect(result).toEqual(expected);
      expect(window.localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getKnownVersions()', () => {
    it('tries to get versions from localStorage', () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(`[{ "version": "3.0.5" }]`);

      expect(getKnownVersions()).toEqual([{ version: '3.0.5' }]);
    });

    it('falls back to a local require', () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(`garbage`);

      expect(getKnownVersions().length).toBe(201);
    });

    it('falls back to a local require', () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(`[{ "garbage": "true" }]`);

      expect(getKnownVersions().length).toBe(201);
    });
  });

  describe('getUpdatedElectronVersions()', () => {
    it('gets known versions', async () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(`[{ "version": "3.0.5" }]`);
      (window as any).localStorage.getItem.mockReturnValueOnce(`[{ "version": "3.0.5" }]`);
      (fetch as any).mockResponse('');

      const result = await getUpdatedElectronVersions();
      const expectedVersion = { version: '3.0.5', state: 'unknown' };

      expect(result).toEqual([{ ...expectedVersion, source: 'remote' }, { ...expectedVersion, source: 'local', state: 'ready' }]);
    });
  });
});
