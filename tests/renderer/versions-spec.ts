import {
  ElectronReleaseChannel,
  fetchVersions,
  getKnownVersions,
  getReleaseChannel,
  getUpdatedElectronVersions
} from '../../src/renderer/versions';

describe('versions', () => {
  describe('getReleaseChannel()', () => {
    it('identifies a nightly release', () => {
      expect(getReleaseChannel({
        tag_name: 'v4.0.0-nightly.20180817'
      } as any)).toBe(ElectronReleaseChannel.nightly);
    });

    it('identifies a beta release', () => {
      expect(getReleaseChannel({
        tag_name: 'v3.0.0-beta.4'
      } as any)).toBe(ElectronReleaseChannel.beta);
    });

    it('identifies an unsupported release', () => {
      expect(getReleaseChannel({
        tag_name: 'v2.1.0-unsupported.20180809'
      } as any)).toBe(ElectronReleaseChannel.unsupported);
    });

    it('identifies a stable release', () => {
      expect(getReleaseChannel({
        tag_name: 'v3.0.0'
      } as any)).toBe(ElectronReleaseChannel.stable);
    });
  });

  describe('fetchVersions()', () => {
    const mockResponseOne = `[{
        "url": "https://api.github.com/repos/electron/electron/releases/11120972",
        "assets_url": "https://api.github.com/repos/electron/electron/releases/11120972/assets",
        "html_url": "https://github.com/electron/electron/releases/tag/v2.0.2",
        "tag_name": "v2.0.2",
        "target_commitish": "2-0-x",
        "name": "electron v2.0.2",
        "prerelease": false,
        "created_at": "2018-05-22T18:52:16Z",
        "published_at": "2018-05-22T20:14:35Z",
        "body": "## Bug Fixes*"
      }, {
        "url": "https://api.github.com/repos/electron/electron/releases/11032425",
        "assets_url": "https://api.github.com/repos/electron/electron/releases/11032425/assets",
        "html_url": "https://github.com/electron/electron/releases/tag/v2.0.1",
        "tag_name": "v2.0.1",
        "target_commitish": "2-0-x",
        "name": "electron v2.0.1",
        "prerelease": false,
        "created_at": "2018-05-16T17:30:26Z",
        "published_at": "2018-05-16T18:40:54Z",
        "body": "## Bug Fixes* Fixed flaky"
      }]`.trim();
    const mockResponseTwo = `[{
        "url": "https://api.github.com/repos/electron/electron/releases/11120972",
        "assets_url": "https://api.github.com/repos/electron/electron/releases/11120972/assets",
        "html_url": "https://github.com/electron/electron/releases/tag/v2.0.2",
        "tag_name": "v2.0.3",
        "target_commitish": "2-0-x",
        "name": "electron v2.0.3",
        "prerelease": false,
        "created_at": "2018-05-22T18:52:16Z",
        "published_at": "2018-05-22T20:14:35Z",
        "body": "## Bug Fixes*"
      }, {
        "url": "https://api.github.com/repos/electron/electron/releases/11032425",
        "assets_url": "https://api.github.com/repos/electron/electron/releases/11032425/assets",
        "html_url": "https://github.com/electron/electron/releases/tag/v2.0.1",
        "tag_name": "v2.0.4",
        "target_commitish": "2-0-x",
        "name": "electron v2.0.4",
        "prerelease": false,
        "created_at": "2018-05-16T17:30:26Z",
        "published_at": "2018-05-16T18:40:54Z",
        "body": "## Bug Fixes* Fixed flaky"
      }]`.trim();

    it('fetches versions', async () => {
      (fetch as any).mockResponseOnce(mockResponseOne);
      (fetch as any).mockResponseOnce(mockResponseTwo);

      const result = await fetchVersions(2);
      const expected = [
        ...JSON.parse(mockResponseOne),
        ...JSON.parse(mockResponseTwo)
      ];

      expect(result).toEqual(expected);
      expect(window.localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getKnownVersions()', () => {
    it('tries to get versions from localStorage', () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(`[{"test":"hi"}]`);

      expect(getKnownVersions()).toEqual([{ test: 'hi' }]);
    });

    it('falls back to a local require', () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(`garbage`);

      expect(getKnownVersions().length).toBe(29);
    });
  });

  describe('getUpdatedElectronVersions()', () => {
    it('gets known versions', async () => {
      (window as any).localStorage.getItem.mockReturnValue(`[{"test":"two"}]`);
      (fetch as any).mockResponse('');

      const result = await getUpdatedElectronVersions(1);
      const expectedVersion = { test: 'two', state: 'unknown' };

      expect(result).toEqual([{ ...expectedVersion, source: 'remote' }, { ...expectedVersion, source: 'local', state: 'ready' }]);
    });
  });
});
