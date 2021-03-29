import * as fs from 'fs-extra';
import * as path from 'path';
import decompress from 'decompress';

import { VersionState } from '../interfaces';
import { normalizeVersion } from '../utils/normalize-version';
import { USER_DATA_PATH } from './constants';
import { removeTypeDefsForVersion } from './fetch-types';
import { AppState } from './state';
import { download as electronDownload } from '@electron/get';

const pendingDownloads: Record<string, Promise<void>> = {};

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

  // If we already have it, then we're done
  if (getIsDownloaded(version)) {
    console.log(`Binary: Electron ${version} already downloaded.`);
    appState.versions[version].state = VersionState.ready;
    return Promise.resolve();
  }

  // Return a promise that resolves when the download completes
  let pending = pendingDownloads[version];
  if (pending) {
    console.log(`Binary: Electron ${version} already downloading.`);
  } else {
    console.log(`Binary: Electron ${version} not present, downloading`);
    pending = pendingDownloads[version] = downloadBinary(appState, version);
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
    delete pendingDownloads[version];
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
  switch (process.platform) {
    case 'darwin':
      return path.join(dir, 'Electron.app/Contents/MacOS/Electron');
    case 'freebsd':
    case 'linux':
      return path.join(dir, 'electron');
    case 'win32':
      return path.join(dir, 'electron.exe');
    default:
      throw new Error(
        `Electron builds are not available for ${process.platform}`,
      );
  }
}

export function getDownloadingVersions(appState: AppState) {
  return Object.entries(appState.versions)
    .filter(([_, { state }]) => state === 'downloading')
    .map(([version, _]) => version);
}

/**
 * Returns an array of all versions downloaded to disk
 *
 * @returns {Promise<Array<string>>}
 */
export async function getDownloadedVersions(): Promise<Array<string>> {
  const downloadPath = path.join(USER_DATA_PATH, 'electron-bin');
  console.log(`Binary: Checking for downloaded versions`);

  try {
    const dirs = await fs.readdir(downloadPath);
    return dirs.filter((dir) => dir && getIsDownloaded(dir));
  } catch (error) {
    console.warn(`Could not read known Electron versions`, error);
    return [];
  }
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
    await decompress(zipPath, dir);
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
