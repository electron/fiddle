import semver from 'semver';
import {
  ElectronReleaseChannel,
  RunnableVersion,
  Version,
  VersionSource,
  VersionState,
} from '../interfaces';
import { getVersionState } from './binary';
import { normalizeVersion } from '../utils/normalize-version';

/**
 * Returns a sensible default version string.
 *
 * @param {Array<RunnableVersion>} knownVersions
 * @returns {string}
 */
export function getDefaultVersion(versions: RunnableVersion[]): string {
  const key = localStorage.getItem('version');
  if (key && versions.some(({ version }) => version === key)) return key;

  // newest stable release
  const latestStable = versions
    .filter((ver) => !ver.version.includes('-')) // stable
    .map((ver) => semver.parse(ver.version))
    .sort((a, b) => -semver.compare(a!, b!))
    .shift();
  if (latestStable) return latestStable.version;

  // how do we not have a stable version listed?
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

  if (tag.includes('beta') || tag.includes('alpha')) {
    return ElectronReleaseChannel.beta;
  }

  if (tag.includes('nightly')) {
    return ElectronReleaseChannel.nightly;
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

export function makeRunnable(ver: Version): RunnableVersion {
  const ret: RunnableVersion = {
    ...ver,
    version: normalizeVersion(ver.version),
    source: Boolean(ver.localPath) ? VersionSource.local : VersionSource.remote,
    state: VersionState.unknown,
  };
  ret.state = getVersionState(ver);
  return ret;
}

/**
 * Return both known as well as local versions.
 *
 * @returns {Array<Version>}
 */
export function getElectronVersions(): Array<RunnableVersion> {
  const versions = [...getReleasedVersions(), ...getLocalVersions()];
  return versions.map((ver) => makeRunnable(ver));
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
 * Get the Version (if any) that is located at localPath.
 *
 * @param {string} input
 * @returns {Version | undefined}
 */
export function getLocalVersionForPath(
  folderPath: string,
): Version | undefined {
  return getLocalVersions().find((v) => v.localPath === folderPath);
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
export function getReleasedVersions(): Array<Version> {
  return getVersions(VersionKeys.known, () =>
    require('../../static/releases.json'),
  );
}

/**
 * Saves known versions to localStorage.
 *
 * @param {Array<Version>} versions
 */
function saveKnownVersions(versions: Array<Version>) {
  return saveVersions(VersionKeys.known, versions);
}

/**
 * Fetch a list of released versions from electronjs.org.
 *
 * @returns {Promise<Version[]>}
 */
export async function fetchVersions(): Promise<Version[]> {
  const url = 'https://releases.electronjs.org/releases.json';
  const response = await window.fetch(url);
  const data = (await response.json()) as { version: string }[];

  const versions: Version[] = data
    // Don't support anything older than 0.30 (Aug 2015).
    // The oldest version known to releases.json.org is 0.20,
    // Pre-0.24.0 versions were technically 'atom-shell' and cannot
    // be downloaded with @electron/get.
    .filter((ver) => !ver.version.startsWith('0.2'))
    .map(({ version }) => ({ version }));

  console.log(`Fetched ${versions.length} new Electron versions`);
  if (versions.length > 0) saveKnownVersions(versions);
  return versions;
}

/**
 * Is the given array an array of versions?
 *
 * @param {Array<any>} input
 * @returns {boolean}
 */
function isExpectedFormat(input: Array<any>): boolean {
  return input.every((entry) => !!entry.version);
}

/**
 * Migrates old versions, if necessary
 *
 * @param {Array<any>} input
 * @returns {Array<Version>}
 */
function migrateVersions(input: Array<any>): Array<Version> {
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

function isElectronVersion(
  input: Version | RunnableVersion,
): input is RunnableVersion {
  return (input as RunnableVersion).source !== undefined;
}

export function getOldestSupportedMajor(): number | undefined {
  const NUM_STABLE_BRANCHES = process.env.NUM_STABLE_BRANCHES || 4;

  return getReleasedVersions()
    .filter((ver) => ver.version.endsWith('.0.0'))
    .map((ver) => Number.parseInt(ver.version))
    .sort((a, b) => a - b)
    .slice(-NUM_STABLE_BRANCHES)
    .shift();
}
