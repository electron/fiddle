import * as fs from 'fs-extra';
import * as path from 'path';
import extract from 'extract-zip';

import {
  RunnableVersion,
  Version,
  VersionSource,
  VersionState,
} from '../interfaces';
import { USER_DATA_PATH } from './constants';
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
 * @param {RunnableVersion} ver
 * @returns {Promise<void>}
 */
export function setupBinary(ver: RunnableVersion): Promise<void> {
  const { version } = ver;

  // Only remote versions can be downloaded
  if (ver.source !== VersionSource.remote) {
    return Promise.resolve();
  }

  // Return a promise that resolves when the download completes
  let pending = downloading.get(version);
  if (!pending) {
    pending = downloadBinary(ver);
    downloading.set(version, pending);
  }
  return pending;
}

async function downloadBinary(ver: RunnableVersion): Promise<void> {
  const { version } = ver;

  ver.state = VersionState.downloading;
  console.log(`Binary: Downloading Electron ${version}`);
  const zipPath = await download(ver);

  const extractPath = getDownloadPath(version);
  console.log(`Binary: Unpacking ${version} to ${extractPath}`);

  try {
    unzipping.add(version);
    downloading.delete(version);
    ver.state = VersionState.unzipping;

    // Ensure the target path exists
    await fs.mkdirp(extractPath);

    // Ensure the target path is empty
    await fs.emptyDir(extractPath);

    await unzip(zipPath, extractPath);
    console.log(`Binary: Unzipped ${version}`);
    ver.state = VersionState.ready;
  } catch (error) {
    console.warn(`Binary: Failure while unzipping ${version}`, error);
    ver.state = VersionState.unknown;
  } finally {
    // This task is done, so remove it from the pending tasks list
    unzipping.delete(version);
  }
}

/**
 * Remove a version from disk. Does not update state. We'll try up to
 * four times before giving up if an error occurs.
 *
 * @param {RunnableVersion} ver
 * @returns {Promise<void>}
 */
export async function removeBinary(ver: RunnableVersion) {
  const { version } = ver;
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
    window.ElectronFiddle.app.electronTypes.uncache(ver);
  };

  await rerunner(binaryCleaner);

  if (isDeleted) {
    ver.state = VersionState.unknown;
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
 * @param {RunnableVersion} ver
 * @returns {Promise<string>} path to the downloaded file
 */
async function download(ver: RunnableVersion): Promise<string> {
  const { version } = ver;

  const getProgressCallback = (progress: Progress) => {
    const percent = Math.round(progress.percent * 100) / 100;
    if (ver.downloadProgress !== percent) {
      ver.downloadProgress = percent;
      console.info(`Binary: Version ${version} download progress: ${percent}`);
    }
  };

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
