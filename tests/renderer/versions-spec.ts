import { fetchVersions, getKnownVersions, getUpdatedKnownVersions } from '../../src/renderer/versions';

describe('versions', () => {
  describe('fetchVersions()', () => {
    const mockResponse = `[{
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

    it('fetches versions', async () => {
      (fetch as any).mockResponse(mockResponse);

      const result = await fetchVersions();

      expect(result).toEqual(JSON.parse(mockResponse));
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

  describe('getUpdatedKnownVersions()', () => {
    it('gets known versions', async () => {
      (window as any).localStorage.getItem.mockReturnValueOnce(`[{"test":"two"}]`);
      (fetch as any).mockResponse('');

      const result = await getUpdatedKnownVersions();

      expect(result).toEqual([{ test: 'two' }]);
    });
  });
});
