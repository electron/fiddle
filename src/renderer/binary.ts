import { remote } from 'electron';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as extract from 'extract-zip';

const eDownload = promisify(require('electron-download'));

class Binary {
  public state: 'ready' | 'downloading' = 'downloading';

  constructor(public readonly version = '2.0.2') {
    this.setup();
  }

  getElectronBinary(version = this.version) {
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

  getDownloadPath(version = this.version) {
    const userData = remote.app.getPath('userData');
    return path.join(userData, 'electron-bin', version);
  }

  getIsDownloaded(version = this.version) {
    const expectedPath = this.getElectronBinary(version);
    return fs.existsSync(expectedPath);
  }

  async setup(version = this.version) {
    await fs.mkdirp(this.getDownloadPath(version));

    if (this.getIsDownloaded()) {
      console.log(`Electron ${version} already downloaded.`);

      this.state = 'ready';
      return;
    }

    console.log(`Electron ${version} not present, downloading`);
    const zipPath = await eDownload({ version });
    const extractPath = this.getDownloadPath();
    console.log(`Electron ${version} downloaded, now unpacking`);
    const electronFiles = await this.unzip(zipPath, extractPath);

    console.log(electronFiles);

    this.state = 'ready';
  }

  unzip(zipPath, extractPath) {
    return new Promise((resolve, reject) => {
      process.noAsar = true;

      extract(zipPath, { dir: extractPath }, (error) => {
        if (error) {
          reject(error);
          return;
        }

        console.log(`Unpacked!`);
        process.noAsar = false;

        resolve();
      });
    });
  }
}

export const binary = new Binary();
