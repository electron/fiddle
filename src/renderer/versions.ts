import { ElectronVersion, ElectronVersionSource, ElectronVersionState, GitHubVersion } from '../interfaces';

export const enum ElectronReleaseChannel {
  stable = 'Stable',
  beta = 'Beta',
  nightly = 'Nightly',
  unsupported = 'Unsupported'
}

/**
 * Return the release channel for a given input
 * version.
 *
 * @param {GitHubVersion} input
 * @returns {ElectronReleaseChannel}
 */
export function getReleaseChannel(
  input: GitHubVersion
): ElectronReleaseChannel {
  const tag = input.tag_name || '';

  if (tag.includes('beta')) {
    return ElectronReleaseChannel.beta;
  }

  if (tag.includes('nightly')) {
    return ElectronReleaseChannel.nightly;
  }

  if (tag.includes('unsupported')) {
    return ElectronReleaseChannel.unsupported;
  }

  // Must be a stable version, right?
  return ElectronReleaseChannel.stable;
}

export const enum VersionKeys {
  local = 'local-electron-versions',
  known = 'known-electron-versions'
}

/**
 * Retrieve Electron versions from localStorage.
 *
 * @param {VersionKeys} key
 * @param {() => Array<GitHubVersion>} fallbackMethod
 * @returns {Array<GitHubVersion>}
 */
function getVersions(
  key: VersionKeys, fallbackMethod: () => Array<GitHubVersion>
): Array<GitHubVersion> {
  const fromLs = window.localStorage.getItem(key);

  if (fromLs) {
    try {
      return JSON.parse(fromLs);
    } catch (error) {
      console.warn(`Parsing local Electron versions failed, returning []`);
    }
  }

  return fallbackMethod();
}

/**
 * Save an array of GitHubVersions to localStorage.
 *
 * @param {VersionKeys} key
 * @param {Array<GitHubVersion} versions
 */
function saveVersions(key: VersionKeys, versions: Array<GitHubVersion>) {
  const stringified = JSON.stringify(versions);
  window.localStorage.setItem(key, stringified);
}

/**
 * Return both known as well as local versions.
 *
 * @returns {Array<GitHubVersion>}
 */
export function getElectronVersions(): Array<ElectronVersion> {
  const known: Array<ElectronVersion> = getKnownVersions().map((version) => {
    return {
      ...version,
      source: ElectronVersionSource.remote,
      state: ElectronVersionState.unknown
    };
  });

  const local: Array<ElectronVersion> = getLocalVersions().map((version) => {
    return {
      ...version,
      source: ElectronVersionSource.local,
      state: ElectronVersionState.ready
    };
  });

  return [ ...known, ...local ];
}

/**
 * Add a version to the local versions
 *
 * @param {GitHubVersion} input
 * @returns {Array<GitHubVersion>}
 */
export function addLocalVersion(input: GitHubVersion): Array<GitHubVersion> {
  const versions = getLocalVersions();

  if (!versions.find((v) => v.url !== input.url)) {
    versions.push(input);
  }

  saveLocalVersions(versions);

  return versions;
}

/**
 * Retrieves local Electron versions, configured by the user.
 *
 * @returns {Array<GitHubVersion>}
 */
export function getLocalVersions(): Array<GitHubVersion> {
  return getVersions(VersionKeys.local, () => []);
}

/**
 * Saves local versions to localStorage.
 *
 * @param {Array<GitHubVersion>} versions
 */
export function saveLocalVersions(versions: Array<GitHubVersion | ElectronVersion>) {
  const filteredVersions = versions.filter((v) => {
    if (isElectronVersion(v)) {
      return v.source === ElectronVersionSource.local;
    }

    return true;
  });

  return saveVersions(VersionKeys.local, filteredVersions);
}

/**
 * Retrieves our best guess regarding the latest Electron versions. Tries to
 * fetch them from localStorage, then from a static releases.json file.
 *
 * @returns {Array<GitHubVersion>}
 */
export function getKnownVersions(): Array<GitHubVersion> {
  return getVersions(VersionKeys.known, () => require('../../static/releases.json'));
}

/**
 * Saves known versions to localStorage.
 *
 * @param {Array<GitHubVersion>} versions
 */
export function saveKnownVersions(versions: Array<GitHubVersion>) {
  return saveVersions(VersionKeys.known, versions);
}

/**
 * Tries to refresh our known versions and returns whatever we have
 * saved after.
 *
 * @export
 * @returns {Promise<Array<ElectronVersion>>}
 */
export async function getUpdatedElectronVersions(
  pages: number,
): Promise<Array<ElectronVersion>> {
  try {
    await fetchVersions(pages);
  } catch (error) {
    console.warn(`Versions: Failed to fetch versions`, { error });
  }

  return getElectronVersions();
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

  if (output && output.length > 0) {
    saveKnownVersions(output);
  }

  return output;
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

export function isElectronVersion(
  input: GitHubVersion | ElectronVersion
): input is ElectronVersion {
  return (input as ElectronVersion).source !== undefined;
}
