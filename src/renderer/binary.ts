import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as extract from 'extract-zip';
import { EventEmitter } from 'events';

import { userData } from './constants';
import { normalizeVersion } from '../utils/normalize-version';
import { StringMap } from '../interfaces';

const eDownload = promisify(require('electron-download'));

export class BinaryManager extends EventEmitter {
  public state: StringMap<'ready' | 'downloading'> = {};
  public version: string = '2.0.2';

  constructor(version: string) {
    super();

    this.setup(version);
  }

  public async setup(iVersion: string) {
    const version = normalizeVersion(iVersion);
    await fs.mkdirp(this.getDownloadPath(version));

    if (this.state[version] === 'downloading') {
      console.log(`BinaryManager: Electron ${version} already downloading.`);
      return;
    }

    if (this.getIsDownloaded(version)) {
      console.log(`BinaryManager: Electron ${version} already downloaded.`);
      this.state[version] = 'ready';
      return;
    }

    console.log(`BinaryManager: Electron ${version} not present, downloading`);
    this.state[version] = 'downloading';

    const zipPath = await eDownload({ version });
    const extractPath = this.getDownloadPath(version);
    console.log(`BinaryManager: Electron ${version} downloaded, now unpacking`);
    const electronFiles = await this.unzip(zipPath, extractPath);
    console.log(electronFiles);

    this.state[version] = 'ready';
  }

  public getElectronBinary(version: string) {
    const platform = os.platform();
    const dir = this.getDownloadPath(version);

    switch (platform) {
      case 'darwin':
        return path.join(dir, 'Electron.app/Contents/MacOS/Electron');
      case 'freebsd':
      case 'linux':
        return path.join(dir, 'electron');
      case 'win32':
        return path.join(dir, 'electron.exe');
      default:
        throw new Error('Electron builds are not available on platform: ' + platform);
    }
  }

  public async getDownloadedVersions(): Promise<Array<string>> {
    const downloadPath = path.join(userData, 'electron-bin');
    console.log(`BinaryManager: Checking for downloaded versions`);

    try {
      const directories = await fs.readdir(downloadPath);
      const knownVersions: Array<string> = [];

      for (const directory of directories) {
        if (this.getIsDownloaded(directory)) {
          knownVersions.push(directory);
        }
      }

      return knownVersions;
    } catch (error) {
      console.warn(`Could not read known Electron versions`);
      return [];
    }
  }

  public getIsDownloaded(version: string) {
    const expectedPath = this.getElectronBinary(version);
    return fs.existsSync(expectedPath);
  }

  private getDownloadPath(version: string) {
    return path.join(userData, 'electron-bin', version);
  }

  private unzip(zipPath: string, extractPath: string) {
    return new Promise((resolve, reject) => {
      process.noAsar = true;

      extract(zipPath, { dir: extractPath }, (error) => {
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
