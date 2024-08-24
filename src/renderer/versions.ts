import { normalizeVersion } from './utils/normalize-version';
import {
  ElectronReleaseChannel,
  GlobalSetting,
  InstallState,
  RunnableVersion,
  Version,
  VersionSource,
  WindowSpecificSetting,
} from '../interfaces';

/**
 * Returns a sensible default version string.
 */
export function getDefaultVersion(versions: RunnableVersion[]): string {
  const key = localStorage.getItem(WindowSpecificSetting.version);
  if (key && versions.some(({ version }) => version === key)) {
    return key;
  }

  const latestStable = window.ElectronFiddle.getLatestStable();
  if (latestStable) return latestStable.version;

  // how do we not have a stable version listed?
  throw new Error('Corrupted version data');
}

/**
 * Return the release channel for a given input
 * version.
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

export function makeRunnable(ver: Version): RunnableVersion {
  // Destructure ver so it's not a Proxy object, which can't be used
  const ret: RunnableVersion = {
    ...ver,
    version: normalizeVersion(ver.version),
    source: Boolean(ver.localPath) ? VersionSource.local : VersionSource.remote,
    state: Boolean(ver.localPath)
      ? window.ElectronFiddle.getLocalVersionState({ ...ver })
      : InstallState.missing,
  };

  return ret;
}

/**
 * Return both known as well as local versions.
 */
export function getElectronVersions(): Array<RunnableVersion> {
  const versions = [...getReleasedVersions(), ...getLocalVersions()];
  return versions.map((ver) => makeRunnable(ver));
}

/**
 * Add a version to the local versions
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
 */
export function getLocalVersionForPath(
  folderPath: string,
): Version | undefined {
  return getLocalVersions().find((v) => v.localPath === folderPath);
}

/**
 * Retrieves local Electron versions, configured by the user.
 */
export function getLocalVersions(): Array<Version> {
  const fromLs = window.localStorage.getItem(GlobalSetting.localVersion);

  if (fromLs) {
    try {
      let result: Array<Version> = JSON.parse(fromLs);

      if (!isExpectedFormat(result)) {
        // Local versions are a bit more tricky and might be in an old format (pre 0.5)
        result = migrateVersions(result);
        saveLocalVersions(result);
      }

      return result;
    } catch {}
  }

  return [];
}

/**
 * Saves local versions to localStorage.
 */
export function saveLocalVersions(
  versions: Array<Version | RunnableVersion>,
): void {
  const filteredVersions = versions.filter((v) => {
    if (isElectronVersion(v)) {
      return v.source === VersionSource.local;
    }

    return true;
  });

  const stringified = JSON.stringify(filteredVersions);
  window.localStorage.setItem(GlobalSetting.localVersion, stringified);
}

function getReleasedVersions(): Array<Version> {
  const versions = window.ElectronFiddle.getReleasedVersions();
  const fromLs = window.localStorage.getItem(GlobalSetting.knownVersion);

  if (fromLs) {
    try {
      const result: Array<Version> = JSON.parse(fromLs);

      // If there are more versions known in localStorage, use
      // those and wait for a subsequent fetch to pull the latest
      // version electronjs.org and remove the localStorage item
      if (result.length > versions.length) {
        return result;
      }
    } catch {}
  }

  return versions;
}

/**
 * Fetch a list of released versions from electronjs.org.
 */
export async function fetchVersions(): Promise<Version[]> {
  const versions = await window.ElectronFiddle.fetchVersions();

  // Migrate away from known versions being stored in localStorage
  // Now that we've fetched new versions, it's safe to delete
  window.localStorage.removeItem(GlobalSetting.knownVersion);

  console.log(`Fetched ${versions.length} new Electron versions`);
  return versions;
}

/**
 * Is the given array an array of versions?
 */
function isExpectedFormat(input: Array<any>): boolean {
  return input.every((entry) => !!entry.version);
}

/**
 * Migrates old versions, if necessary
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
