import * as fs from 'fs-extra';
import * as path from 'path';
import extract from 'extract-zip';

import { Version, VersionSource, VersionState } from '../interfaces';
import { normalizeVersion } from '../utils/normalize-version';
import { USER_DATA_PATH } from './constants';
import { removeTypeDefsForVersion } from './fetch-types';
import { AppState } from './state';
import { download as electronDownload } from '@electron/get';

// versions that are currently being downloaded
const downloading: Map<string, Promise<void>> = new Map();

// versions that are currently being unzipped
const unzipping: Set<string> = new Set();

/**
 * Determine by inspection the VersionState of this version
 *
 * @param {Version} version
 * @returns {VersionState} the state of the version
 */
export function getVersionState(ver: Version): VersionState {
  const { localPath, version } = ver;

  if (downloading.has(version)) {
    return VersionState.downloading;
  }

  if (unzipping.has(version)) {
    return VersionState.unzipping;
  }

  const dir = localPath || getDownloadPath(version);
  const exec = path.join(dir, execSubpath());
  return fs.existsSync(exec) ? VersionState.ready : VersionState.unknown;
}

/**
 * General setup, called with a version. Is called during construction
 * to ensure that we always have or download at least one version.
 *
 * @param {string} iVersion
 * @returns {Promise<void>}
 */
export function setupBinary(
  appState: AppState,
  iVersion: string,
): Promise<void> {
  const version = normalizeVersion(iVersion);

  // Only remote versions can be downloaded
  if (appState.versions[version].source !== VersionSource.remote) {
    return Promise.resolve();
  }

  // If we already have it, then we're done
  if (getIsDownloaded(version)) {
    console.log(`Binary: Electron ${version} already downloaded.`);
    appState.versions[version].state = VersionState.ready;
    return Promise.resolve();
  }

  // Return a promise that resolves when the download completes
  let pending = downloading.get(version);
  if (pending) {
    console.log(`Binary: Electron ${version} already downloading.`);
  } else {
    console.log(`Binary: Electron ${version} not present, downloading`);
    pending = downloadBinary(appState, version);
    downloading.set(version, pending);
  }
  return pending;
}

async function downloadBinary(
  appState: AppState,
  version: string,
): Promise<void> {
  appState.versions[version].state = VersionState.downloading;

  const zipPath = await download(appState, version);
  const extractPath = getDownloadPath(version);
  console.log(
    `Binary: Electron ${version} downloaded, now unpacking to ${extractPath}`,
  );

  try {
    unzipping.add(version);
    downloading.delete(version);
    appState.versions[version].state = VersionState.unzipping;

    // Ensure the target path exists
    await fs.mkdirp(extractPath);

    // Ensure the target path is empty
    await fs.emptyDir(extractPath);

    const electronFiles = await unzip(zipPath, extractPath);
    console.log(`Binary: Unzipped ${version}`, electronFiles);
    appState.versions[version].state = VersionState.ready;
  } catch (error) {
    console.warn(`Binary: Failure while unzipping ${version}`, error);
    appState.versions[version].state = VersionState.unknown;
  } finally {
    // This task is done, so remove it from the pending tasks list
    unzipping.delete(version);
  }
}

/**
 * Remove a version from disk. Does not update state. We'll try up to
 * four times before giving up if an error occurs.
 *
 * @param {string} iVersion
 * @returns {Promise<void>}
 */
export async function removeBinary(iVersion: string) {
  const version = normalizeVersion(iVersion);
  let isDeleted = false;

  // utility to re-run removal functions upon failure
  // due to windows filesystem lockfile jank
  const rerunner = async (func: () => Promise<void>, counter = 1) => {
    try {
      await func();
    } catch (error) {
      console.warn(
        `Binary Manager: failed to run ${func.name} for ${version}, but failed`,
        error,
      );
      if (counter < 4) {
        console.log(`Binary Manager: Trying again to run ${func.name}`);
        await rerunner(func, counter + 1);
      }
    }
  };

  const binaryCleaner = async () => {
    if (getIsDownloaded(version)) {
      // This is necessary since we're messing with .asar files inside
      // the Electron binaries. Electron, powering Fiddle, will try to
      // "correct" our calls, but we don't want that right here.
      process.noAsar = true;
      await fs.remove(getDownloadPath(version));
      process.noAsar = false;

      isDeleted = true;
    }
  };

  const typeDefsCleaner = async () => {
    await removeTypeDefsForVersion(version);
  };

  await rerunner(binaryCleaner);

  if (isDeleted) {
    await rerunner(typeDefsCleaner);
  }
}

/* Did we already download a given version?
 *
 * @param {string} version
 * @param {string} dir
 * @returns {boolean}
 */
export function getIsDownloaded(version: string, dir?: string): boolean {
  const expectedPath = getElectronBinaryPath(version, dir);
  return fs.existsSync(expectedPath);
}

function execSubpath() {
  const { platform } = process;
  switch (platform) {
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron';
    case 'linux':
    case 'freebsd':
      return 'electron';
    case 'win32':
      return 'electron.exe';
    default:
      throw new Error(`Electron builds are not available for ${platform}`);
  }
}

/**
 * Gets the expected path for the binary of a given Electron version
 *
 * @param {string} version
 * @param {string} dir
 * @returns {string}
 */
export function getElectronBinaryPath(
  version: string,
  dir: string = getDownloadPath(version),
): string {
  return path.join(dir, execSubpath());
}

/**
 * Download an Electron version.
 *
 * @param {AppState} appState
 * @param {string} version
 * @returns {Promise<string>}
 */
async function download(appState: AppState, version: string): Promise<string> {
  const getProgressCallback = (progress: Progress) => {
    const roundedProgress = Math.round(progress.percent * 100) / 100;

    if (roundedProgress !== appState.versions[version].downloadProgress) {
      console.debug(
        `Binary: Version ${version} download progress: ${progress.percent}`,
      );
      appState.versions[version].downloadProgress = roundedProgress;
    }
  };

  if (!appState.versions[version]) {
    throw new Error(
      `Version ${version} does not exist in state, cannot download`,
    );
  }

  const zipFilePath = await electronDownload(version, {
    downloadOptions: {
      quiet: true,
      getProgressCallback,
    },
  });

  return zipFilePath;
}

/**
 * Gets the expected path for a given Electron version
 *
 * @param {string} version
 * @returns {string}
 */
function getDownloadPath(version: string): string {
  return path.join(USER_DATA_PATH, 'electron-bin', version);
}

/**
 * Unzips an electron package so that we can actually use it.
 *
 * @param {string} zipPath
 * @param {string} dir
 * @returns {Promise<void>}
 */
async function unzip(zipPath: string, dir: string): Promise<void> {
  process.noAsar = true;

  try {
    await extract(zipPath, { dir });
    console.log(`Binary: Unpacked!`);
  } finally {
    process.noAsar = false;
  }
}

interface Progress {
  percent: number;
  transferred: number;
  total: number;
}
