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
 * One-time migration: move local versions from localStorage to main process.
 * Must be called before getElectronVersions().
 */
export function migrateLocalVersionsFromLocalStorage(): void {
  const raw = window.localStorage.getItem(GlobalSetting.localVersion);
  if (!raw) return;

  try {
    const versions: Array<Version> = JSON.parse(raw);
    if (!Array.isArray(versions) || versions.length === 0) {
      // Nothing to migrate, just clean up
      window.localStorage.removeItem(GlobalSetting.localVersion);
      return;
    }

    const accepted = window.ElectronFiddle.migrateLocalVersions(versions);
    if (accepted) {
      window.localStorage.removeItem(GlobalSetting.localVersion);
    }
  } catch {
    // Corrupt data - remove it
    window.localStorage.removeItem(GlobalSetting.localVersion);
  }
}

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
 * Add a version to the local versions (stored in main process).
 * Requires a token issued by selectLocalVersion.
 */
export function addLocalVersion(token: string, name: string): Array<Version> {
  return window.ElectronFiddle.addLocalVersion(token, name);
}

/**
 * Retrieves local Electron versions from the main process.
 */
export function getLocalVersions(): Array<Version> {
  return window.ElectronFiddle.getLocalVersions();
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
