import * as fsType from 'fs-extra';
import * as path from 'path';
import * as extractZipType from 'extract-zip';

import { VersionState } from '../interfaces';
import { fancyImport } from '../utils/import';
import { normalizeVersion } from '../utils/normalize-version';
import { USER_DATA_PATH } from './constants';
import { removeTypeDefsForVersion } from './fetch-types';
import { AppState } from './state';

/**
 * General setup, called with a version. Is called during construction
 * to ensure that we always have or download at least one version.
 *
 * @param {string} iVersion
 * @returns {Promise<void>}
 */
export async function setupBinary(
  appState: AppState,
  iVersion: string,
): Promise<void> {
  const version = normalizeVersion(iVersion);
  const fs = await fancyImport<typeof fsType>('fs-extra');

  await fs.mkdirp(getDownloadPath(version));

  const { state } = appState.versions[version];
  if (state === VersionState.downloading || state === VersionState.unzipping) {
    console.log(`Binary: Electron ${version} already downloading.`);
    return;
  }

  if (await getIsDownloaded(version)) {
    console.log(`Binary: Electron ${version} already downloaded.`);
    appState.versions[version].state = VersionState.ready;
    return;
  }

  console.log(`Binary: Electron ${version} not present, downloading`);
  appState.versions[version].state = VersionState.downloading;

  const zipPath = await download(appState, version);
  const extractPath = getDownloadPath(version);
  console.log(
    `Binary: Electron ${version} downloaded, now unpacking to ${extractPath}`,
  );

  try {
    appState.versions[version].state = VersionState.unzipping;

    // Ensure the target path is empty
    await fs.emptyDir(extractPath);

    const electronFiles = await unzip(zipPath, extractPath);
    console.log(`Unzipped ${version}`, electronFiles);
  } catch (error) {
    console.warn(`Failure while unzipping ${version}`, error);
    appState.versions[version].state = VersionState.unknown;

    return;
  }

  appState.versions[version].state = VersionState.ready;
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
  const fs = await fancyImport<typeof fsType>('fs-extra');
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
    if (await getIsDownloaded(version)) {
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
export async function getIsDownloaded(
  version: string,
  dir?: string,
): Promise<boolean> {
  const expectedPath = getElectronBinaryPath(version, dir);
  const fs = await fancyImport<typeof fsType>('fs-extra');

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
  const fs = await fancyImport<typeof fsType>('fs-extra');
  const downloadPath = path.join(USER_DATA_PATH, 'electron-bin');
  console.log(`Binary: Checking for downloaded versions`);

  try {
    const directories = await fs.readdir(downloadPath);
    const knownVersions: Array<string> = [];

    for (const directory of directories) {
      if (await getIsDownloaded(directory)) {
        knownVersions.push(directory);
      }
    }

    return knownVersions;
  } catch (error) {
    console.warn(`Could not read known Electron versions`);
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
  const { download: electronDownload } = await import('@electron/get');
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
  const extract: typeof extractZipType = (await fancyImport<any>('extract-zip'))
    .default;

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
