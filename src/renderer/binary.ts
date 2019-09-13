import * as fsType from 'fs-extra';
import * as path from 'path';

import { fancyImport } from '../utils/import';
import { normalizeVersion } from '../utils/normalize-version';
import { USER_DATA_PATH } from './constants';
import { getOfflineTypeDefinitionPath } from './fetch-types';

/**
 * The binary manager takes care of downloading Electron versions
 *
 * @export
 * @class BinaryManager
 */
export class BinaryManager {
  public state: Record<string, 'ready' | 'downloading'> = {};

  /**
   * Remove a version from disk. Does not update state. We'll try up to
   * four times before giving up if an error occurs.
   *
   * @param {string} iVersion
   * @returns {Promise<void>}
   */
  public async remove(iVersion: string): Promise<void> {
    const version = normalizeVersion(iVersion);
    const fs = await fancyImport<typeof fsType>('fs-extra');
    let isDeleted = false;

    // utility to re-run removal functions upon failure
    // due to windows filesystem lockfile jank
    const rerunner = async (func: () => Promise<void>, counter: number = 1) => {
      try {
        await func();
      } catch (error) {
        console.warn(`Binary Manager: failed to run ${func.name} for ${version}, but failed`, error);
        if (counter < 4) {
          console.log(`Binary Manager: Trying again to run ${func.name}`);
          await rerunner(func, counter + 1);
        }
      }
    };

    const binaryCleaner = async () => {
      if (await this.getIsDownloaded(version)) {
        // This is necessary since we're messing with .asar files inside
        // the Electron binaries. Electron, powering Fiddle, will try to
        // "correct" our calls, but we don't want that right here.
        process.noAsar = true;
        await fs.remove(this.getDownloadPath(version));
        process.noAsar = false;

        isDeleted = true;
      }
    };

    const typeDefsCleaner = async () => {
      await this.removeTypeDefsForVersion(version);
    };

    await rerunner(binaryCleaner);

    if (isDeleted) {
      await rerunner(typeDefsCleaner);
    }
  }

  /**
   * General setup, called with a version. Is called during construction
   * to ensure that we always have or download at least one version.
   *
   * @param {string} iVersion
   * @returns {Promise<void>}
   */
  public async setup(iVersion: string): Promise<void> {
    const version = normalizeVersion(iVersion);
    const fs = await fancyImport<typeof fsType>('fs-extra');
    const { promisify } = await import('util');
    const eDownload = promisify(require('electron-download'));

    await fs.mkdirp(this.getDownloadPath(version));

    if (this.state[version] === 'downloading') {
      console.log(`BinaryManager: Electron ${version} already downloading.`);
      return;
    }

    if (await this.getIsDownloaded(version)) {
      console.log(`BinaryManager: Electron ${version} already downloaded.`);
      this.state[version] = 'ready';
      return;
    }

    console.log(`BinaryManager: Electron ${version} not present, downloading`);
    this.state[version] = 'downloading';

    const zipPath = await eDownload({ version });
    const extractPath = this.getDownloadPath(version);
    console.log(`BinaryManager: Electron ${version} downloaded, now unpacking to ${extractPath}`);

    try {
      // Ensure the target path is empty
      await fs.emptyDir(extractPath);

      const electronFiles = await this.unzip(zipPath, extractPath);
      console.log(`Unzipped ${version}`, electronFiles);
    } catch (error) {
      console.warn(`Failure while unzipping ${version}`, error);

      // TODO: Handle this case
    }

    this.state[version] = 'ready';
  }

  /**
   * Gets the expected path for the binary of a given Electron version
   *
   * @param {string} version
   * @param {string} dir
   * @returns {string}
   */
  public getElectronBinaryPath(
    version: string,
    dir: string = this.getDownloadPath(version),
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
        throw new Error(`Electron builds are not available for ${process.platform}`);
    }
  }

  /**
   * Returns an array of all versions downloaded to disk
   *
   * @returns {Promise<Array<string>>}
   */
  public async getDownloadedVersions(): Promise<Array<string>> {
    const fs = await fancyImport<typeof fsType>('fs-extra');
    const downloadPath = path.join(USER_DATA_PATH, 'electron-bin');
    console.log(`BinaryManager: Checking for downloaded versions`);

    try {
      const directories = await fs.readdir(downloadPath);
      const knownVersions: Array<string> = [];

      for (const directory of directories) {
        if (await this.getIsDownloaded(directory)) {
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
   * Did we already download a given version?
   *
   * @param {string} version
   * @param {string} dir
   * @returns {boolean}
   */
  public async getIsDownloaded(version: string, dir?: string): Promise<boolean> {
    const expectedPath = this.getElectronBinaryPath(version, dir);
    const fs = await fancyImport<typeof fsType>('fs-extra');

    return fs.existsSync(expectedPath);
  }

  public async removeTypeDefsForVersion(version: string) {
    const fs = await fancyImport<typeof fsType>('fs-extra');
    const _version = normalizeVersion(version);
    const typeDefsDir = path.dirname(getOfflineTypeDefinitionPath(_version));

    if (fs.existsSync(typeDefsDir)) {
      try {
        await fs.remove(typeDefsDir);
      } catch (error) {
        throw error;
      }
    }
  }

  /**
   * Gets the expected path for a given Electron version
   *
   * @param {string} version
   * @returns {string}
   */
  private getDownloadPath(version: string): string {
    return path.join(USER_DATA_PATH, 'electron-bin', version);
  }


  /**
   * Unzips an electron package so that we can actually use it.
   *
   * @param {string} zipPath
   * @param {string} extractPath
   * @returns {Promise<void>}
   */
  private unzip(zipPath: string, extractPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const extract = (await fancyImport<any>('extract-zip')).default;

      process.noAsar = true;

      const options = {
        dir: extractPath,
      };

      extract(zipPath, options, (error: Error) => {
        if (error) {
          reject(error);
          return;
        }

        console.log(`BinaryManager: Unpacked!`);
        process.noAsar = false;

        resolve();
      });
    });
  }
}
