import {
  ElectronReleaseChannel,
  GlobalSetting,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import {
  addLocalVersion,
  fetchVersions,
  getDefaultVersion,
  getLocalVersions,
  getReleaseChannel,
  saveLocalVersions,
} from '../../src/renderer/versions';

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
      (window.ElectronFiddle.getLatestStable as jest.Mock).mockReturnValue({
        version: '13.0.0',
      });
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

      expect(window.localStorage.setItem).toBeCalledWith(
        GlobalSetting.localVersion,
        JSON.stringify(mockLocalVersions),
      );
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
    it('removes knownVersions from localStorage', async () => {
      (window.ElectronFiddle.fetchVersions as jest.Mock).mockResolvedValue([]);
      await fetchVersions();
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        GlobalSetting.knownVersion,
      );
    });
  });
});
