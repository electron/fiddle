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
export async function getUpdatedKnownVersions(
  pages: number
): Promise<Array<GitHubVersion>> {
  try {
    await fetchVersions(pages);
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
export async function fetchVersions(pages: number) {
  const output: Array<GitHubVersion> = [];

  for (let i = 0; i < pages; i++) {
    const page = await fetchVersionPage(i + 1);

    if (page && page.length > 0 && page[0].tag_name) {
      page.forEach((release) => {
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

        output.push(updated as GitHubVersion);
      });
    }
  }

  saveKnownVersions(output);
}

/**
 * Fetch a single releases page from GitHub.
 *
 * @returns {Promise<Array<GitHubVersion>>}
 */
export function fetchVersionPage(page?: number): Promise<Array<GitHubVersion>> {
  const url = `https://api.github.com/repos/electron/electron/releases`
    + ((page && page > 1) ? `?page=${page}` : '');

  return window.fetch(url)
    .then((response) => response.json());
}
