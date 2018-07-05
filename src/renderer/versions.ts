import { GitHubVersion } from '../interfaces';

/**
 * Retrieves our best guess regarding the latest Electron versions. Tries to
 * fetch them from localStorage, then from a static releases.json file.
 *
 * @returns {Array<GitHubVersion>}
 */
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

/**
 * Saves known versions to localStorage.
 *
 * @param {Array<GitHubVersion>} versions
 */
export function saveKnownVersions(versions: Array<GitHubVersion>) {
  const stringified = JSON.stringify(versions);
  window.localStorage.setItem('known-electron-versions', stringified);
}

/**
 * Tries to refresh our known versions and returns whatever we have
 * saved after.
 *
 * @export
 * @returns {Promise<Array<GitHubVersion>>}
 */
export async function getUpdatedKnownVersions(): Promise<Array<GitHubVersion>> {
  try {
    await fetchVersions();
  } catch (error) {
    console.warn(`Versions: Failed to fetch versions`, { error });
  }

  return getKnownVersions();
}

/**
 * Fetch the latest known versions directly from GitHub.
 *
 * @returns {Promise<Array<GitHubVersion>>}
 */
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
