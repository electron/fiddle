import { GitHubVersion } from '../interfaces';

export function getKnownVersions(): Array<GitHubVersion> {
  const fromLs = window.localStorage.getItem('known-electron-versions');

  if (fromLs) {
    try {
      return JSON.parse(fromLs);
    } catch (error) {
      console.warn(`Parsing known versions failed, falling back`);
    }
  }

  return require('../../static/releases.json');
}

export function saveKnownVersions(versions: Array<GitHubVersion>) {
  const stringified = JSON.stringify(versions);
  window.localStorage.setItem('known-electron-versions', stringified);
}

export function fetchVersions(): Promise<Array<GitHubVersion>> {
  return window.fetch('https://api.github.com/repos/electron/electron/releases')
    .then((response) => response.json())
    .then((data: Array<GitHubVersion>) => {
      let cleaned: Array<GitHubVersion> = [];

      if (data && data.length > 0 && data[0].tag_name) {
        cleaned = data.map((release) => {
          const updated = {
            url: release.url,
            assets_url: release.assets_url,
            html_url: release.html_url,
            tag_name: release.tag_name,
            target_commitish: release.target_commitish,
            name: release.name,
            prerelease: release.prerelease,
            created_at: release.created_at,
            published_at: release.published_at,
            body: release.body
          };

          return updated as GitHubVersion;
        });

        saveKnownVersions(cleaned);
      }

      return cleaned;
    });
}
