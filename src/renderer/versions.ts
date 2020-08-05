import semver from 'semver';
import {
  RunnableVersion,
  Version,
  VersionSource,
  VersionState,
} from '../interfaces';
import { normalizeVersion } from '../utils/normalize-version';

export const enum ElectronReleaseChannel {
  stable = 'Stable',
  beta = 'Beta',
  nightly = 'Nightly',
  unsupported = 'Unsupported',
}

/**
 * Returns a sensible default version string.
 *
 * @param {Array<RunnableVersion>} knownVersions
 * @returns {string}
 */
export function getDefaultVersion(
  knownVersions: Array<RunnableVersion> = [],
): string {
  const ls = localStorage.getItem('version');

  if (
    ls &&
    knownVersions &&
    knownVersions.find(({ version }) => version === ls)
  ) {
    return ls;
  }

  // Self-heal: Version not formated correctly
  const normalized = ls && normalizeVersion(ls);
  if (normalized) {
    if (
      knownVersions &&
      knownVersions.find(({ version }) => version === normalized)
    ) {
      return normalized;
    }
  }

  // Alright, the first version?
  const last = knownVersions && knownVersions[knownVersions.length - 1];
  if (last) {
    return last.version;
  }

  // Report error
  throw new Error('Corrupted version data');
}

/**
 * Return the release channel for a given input
 * version.
 *
 * @param {Version | string} input
 * @returns {ElectronReleaseChannel}
 */
export function getReleaseChannel(
  input: Version | string,
): ElectronReleaseChannel {
  const tag = typeof input === 'string' ? input : input.version || '';

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
  known = 'known-electron-versions',
}

/**
 * Retrieve Electron versions from localStorage.
 *
 * @param {VersionKeys} key
 * @param {() => Array<Version>} fallbackMethod
 * @returns {Array<Version>}
 */
function getVersions(
  key: VersionKeys,
  fallbackMethod: () => Array<Version>,
): Array<Version> {
  const fromLs = window.localStorage.getItem(key);

  if (fromLs) {
    try {
      let result: Array<Version> = JSON.parse(fromLs);

      if (!isExpectedFormat(result)) {
        // Known versions can just be downloaded again.
        if (key === VersionKeys.known) {
          throw new Error(
            `Electron versions in LS does not match expected format`,
          );
        }

        // Local versions are a bit more tricky and might be in an old format (pre 0.5)
        result = migrateVersions(result);
        saveLocalVersions(result);
      }

      return result;
    } catch (error) {
      console.warn(
        `Parsing local Electron versions failed, returning fallback method.`,
      );
    }
  }

  return fallbackMethod();
}

/**
 * Save an array of GitHubVersions to localStorage.
 *
 * @param {VersionKeys} key
 * @param {Array<Version} versions
 */
function saveVersions(key: VersionKeys, versions: Array<Version>) {
  const stringified = JSON.stringify(versions);
  window.localStorage.setItem(key, stringified);
}

/**
 * Return both known as well as local versions.
 *
 * @returns {Array<Version>}
 */
export function getElectronVersions(): Array<RunnableVersion> {
  const known: Array<RunnableVersion> = getKnownVersions().map((version) => {
    return {
      ...version,
      source: VersionSource.remote,
      state: VersionState.unknown,
    };
  });

  const local: Array<RunnableVersion> = getLocalVersions().map((version) => {
    return {
      ...version,
      source: VersionSource.local,
      state: VersionState.ready,
    };
  });

  return [...known, ...local];
}

/**
 * Add a version to the local versions
 *
 * @param {Version} input
 * @returns {Array<Version>}
 */
export function addLocalVersion(input: Version): Array<Version> {
  const versions = getLocalVersions();

  if (!versions.find((v) => v.localPath === input.localPath)) {
    versions.push(input);
  }

  saveLocalVersions(versions);

  return versions;
}

/**
 * Retrieves local Electron versions, configured by the user.
 *
 * @returns {Array<Version>}
 */
export function getLocalVersions(): Array<Version> {
  const versions = getVersions(VersionKeys.local, () => []);

  return versions;
}

/**
 * Saves local versions to localStorage.
 *
 * @param {Array<Version>} versions
 */
export function saveLocalVersions(versions: Array<Version | RunnableVersion>) {
  const filteredVersions = versions.filter((v) => {
    if (isElectronVersion(v)) {
      return v.source === VersionSource.local;
    }

    return true;
  });

  return saveVersions(VersionKeys.local, filteredVersions);
}

/**
 * Retrieves our best guess regarding the latest Electron versions. Tries to
 * fetch them from localStorage, then from a static releases.json file.
 *
 * @returns {Array<Version>}
 */
export function getKnownVersions(): Array<Version> {
  return getVersions(VersionKeys.known, () =>
    require('../../static/releases.json'),
  );
}

/**
 * Saves known versions to localStorage.
 *
 * @param {Array<Version>} versions
 */
export function saveKnownVersions(versions: Array<Version>) {
  return saveVersions(VersionKeys.known, versions);
}

/**
 * Tries to refresh our known versions and returns whatever we have
 * saved after.
 *
 * @export
 * @returns {Promise<Array<RunnableVersion>>}
 */
export async function getUpdatedElectronVersions(): Promise<
  Array<RunnableVersion>
> {
  try {
    await fetchVersions();
  } catch (error) {
    console.warn(`Versions: Failed to fetch versions`, { error });
  }

  return getElectronVersions();
}

/**
 * Fetch the latest known versions directly from npm.
 *
 * @returns {Promise<Array<Version>>}
 */
export async function fetchVersions() {
  const response = await window.fetch(
    'https://unpkg.com/electron-releases/lite.json',
  );
  const data = await response.json();

  // pre-0.24.0 versions were technically 'atom-shell' and cannot
  // be downloaded with @electron/get
  const MIN_DOWNLOAD_VERSION = '0.24.0';

  const output = data
    .map(({ version }: any) => ({ version }))
    .filter(({ version }: any) => semver.gte(version, MIN_DOWNLOAD_VERSION));

  if (output?.length > 0 && isExpectedFormat(output)) {
    console.log(`Fetched new Electron versions (Count: ${output.length})`);
    saveKnownVersions(output);
  }

  return output;
}

/**
 * Is the given array an array of versions?
 *
 * @param {Array<any>} input
 * @returns {boolean}
 */
export function isExpectedFormat(input: Array<any>): boolean {
  return input.every((entry) => !!entry.version);
}

/**
 * Migrates old versions, if necessary
 *
 * @param {Array<any>} input
 * @returns {Array<Version>}
 */
export function migrateVersions(input: Array<any> = []): Array<Version> {
  return input
    .filter((item) => !!item)
    .map((item) => {
      const { tag_name, name, url } = item;

      if (!tag_name || !name || !url) return null;

      return {
        version: tag_name,
        name,
        localPath: url,
      };
    })
    .filter((item) => !!item) as Array<Version>;
}

export function isElectronVersion(
  input: Version | RunnableVersion,
): input is RunnableVersion {
  return (input as RunnableVersion).source !== undefined;
}
