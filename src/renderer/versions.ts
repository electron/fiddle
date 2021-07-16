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
 * @param {Array<RunnableVersion>}
 * @returns {string}
 */
export function getDefaultVersion(versions: RunnableVersion[]): string {
  const key = localStorage.getItem('version');
  if (key && versions.some(({ version }) => version === key)) return key;

  // newest stable release
  const latestStable = versions
    .map(({ version }) => semver.parse(version))
    .filter((sem) => Boolean(sem) && sem!.prerelease.length === 0)
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
  released = 'known-electron-versions',
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
        // Released versions can just be downloaded again.
        if (key === VersionKeys.released) {
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
 * Create a RunnableVersion from a Version
 */
function makeRunnableVersion(ver: Version): RunnableVersion {
  const isLocal = Boolean(ver.localPath);
  const run: RunnableVersion = {
    ...ver,
    source: isLocal ? VersionSource.local : VersionSource.remote,
    state: VersionState.unknown,
    version: normalizeVersion(ver.version),
  };
  run.state = getVersionState(run);
  return run;
}

/**
 * Get an array of both released and local versions.
 *
 * @returns {Array<Version>}
 */
export function getElectronVersions(): Array<RunnableVersion> {
  const versions = [...getReleasedVersions(), ...getLocalVersions()];
  return versions.map((ver) => makeRunnableVersion(ver));
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
  return getVersions(VersionKeys.released, () =>
    require('../../static/releases.json'),
  );
}

/**
 * Saves released versions to localStorage.
 *
 * @param {Array<Version>} versions
 */
function saveReleasedVersions(versions: Array<Version>) {
  return saveVersions(VersionKeys.released, versions);
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
    await fetchReleasedVersions();
  } catch (error) {
    console.warn(`Versions: Failed to fetch versions`, { error });
  }

  return getElectronVersions();
}

/**
 * Fetch a list of released versions from electronjs.org.
 *
 * @returns {Promise<Version[]>}
 */
export async function fetchReleasedVersions(): Promise<Version[]> {
  const url = 'https://releases.electronjs.org/releases.json';
  const response = await window.fetch(url);
  const data = (await response.json()) as { version: string }[];

  // pre-0.24.0 versions were technically 'atom-shell' and cannot
  // be downloaded with @electron/get
  const MIN_DOWNLOAD_VERSION = semver.parse('0.24.0')!;

  const versions: Version[] = data
    .map(({ version }) => ({ version }))
    .filter(({ version }) => semver.gte(version, MIN_DOWNLOAD_VERSION));

  console.log(`Fetched ${versions.length} new Electron versions`);
  if (versions.length > 0) saveReleasedVersions(versions);
  return versions;
}

/**
 * Is it an array of versions?
 *
 * @param {unknown} input
 * @returns {boolean}
 */
function isExpectedFormat(input: unknown): boolean {
  return Array.isArray(input) && input.every((item) => Boolean(item.version));
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

export function getOldestSupportedVersion(): string | undefined {
  const NUM_STABLE_BRANCHES = process.env.NUM_STABLE_BRANCHES || 4;

  const oldestSupported = getReleasedVersions()
    .map(({ version }) => version)
    .filter((version) => /^\d+\.0\.0$/.test(version))
    .sort(semver.compare)
    .slice(-NUM_STABLE_BRANCHES)
    .shift();
  return oldestSupported;
}
