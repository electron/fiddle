import {
  getElectronBinaryPath,
  getVersionState,
  removeBinary,
  setupBinary,
} from '../../src/renderer/binary';
import {
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../src/interfaces';
import { overridePlatform, resetPlatform, waitFor } from '../utils';

import * as path from 'path';
import * as semver from 'semver';
import extract from 'extract-zip';
import { download as electronDownload } from '@electron/get';

jest.mock('fs-extra');
jest.mock('extract-zip');
jest.mock('@electron/get');
jest.mock('../../src/renderer/ipc', () => ({}));
jest.mock('../../src/renderer/constants', () => ({
  USER_DATA_PATH: 'user/data/',
}));

describe('binary', () => {
  const fs = require('fs-extra');
  let ver: RunnableVersion;
  let version = '3.0.0';

  beforeEach(() => {
    // the download module holds state between runs,
    // so use a unique version number in each test to
    // prevent state pollution
    version = semver.inc(version, 'patch')!;
    ver = {
      source: VersionSource.remote,
      state: VersionState.unknown,
      version,
    };
  });

  afterEach(() => {
    resetPlatform();
  });

  describe('remove()', () => {
    it('removes a version', async () => {
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await removeBinary(ver);
      expect(fs.remove).toHaveBeenCalled();
    });

    it('retries on failure', async () => {
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      (fs.remove as jest.Mock<any>).mockImplementation(() => {
        throw new Error('Bwap bwap');
      });

      await removeBinary(ver);
      expect(fs.remove).toHaveBeenCalledTimes(4);
    });

    it("attempts to clean up the version's associated typedefs", async () => {
      const { electronTypes } = window.ElectronFiddle.app;
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      await removeBinary(ver);
      expect(electronTypes.uncache).toHaveBeenCalledWith(ver);
    });

    it('retries typedef cleanup upon failure', async () => {
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      const { electronTypes } = window.ElectronFiddle.app;
      const uncacheSpy = jest
        .spyOn(electronTypes, 'uncache')
        .mockImplementation(() => {
          throw new Error('Bwap bwap');
        });

      await removeBinary(ver);
      expect(uncacheSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('getVersionState()', () => {
    it(`returns ${VersionState.downloading} when downloading`, () => {
      // mock a download in progress
      let downloadResolve: any;
      (electronDownload as jest.Mock).mockReturnValueOnce(
        new Promise((r) => (downloadResolve = r)),
      );

      setupBinary(ver);

      expect(getVersionState(ver)).toBe(VersionState.downloading);
      downloadResolve();
    });

    it(`returns ${VersionState.unzipping} when unzipping`, async () => {
      // mock a completed download + an unzip in progress
      (electronDownload as jest.Mock).mockResolvedValueOnce('/fake/path');
      let unzipResolve: any;
      const unzipPromise = new Promise((r) => (unzipResolve = r));
      (extract as jest.Mock).mockReturnValueOnce(unzipPromise);

      setupBinary(ver);
      await waitFor(() => getVersionState(ver) === VersionState.unzipping);

      expect(getVersionState(ver)).toBe(VersionState.unzipping);
      unzipResolve();
    });

    it(`returns ${VersionState.ready} when it is a local version that exists`, async () => {
      ver.source = VersionSource.local;
      ver.localPath = '/fake/path';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      expect(getVersionState(ver)).toBe(VersionState.ready);
    });

    it(`returns ${VersionState.unknown} when it is a local version that is missing`, async () => {
      ver.source = VersionSource.local;
      ver.localPath = '/fake/path';
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(getVersionState(ver)).toBe(VersionState.unknown);
    });

    it(`returns ${VersionState.ready} when it is a remote version that is downloaded`, async () => {
      ver.source = VersionSource.remote;
      ver.localPath = undefined;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      expect(getVersionState(ver)).toBe(VersionState.ready);
    });

    it(`returns ${VersionState.unknown} when it is a remote version is not downloaded`, async () => {
      ver.source = VersionSource.remote;
      ver.localPath = undefined;
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(getVersionState(ver)).toBe(VersionState.unknown);
    });
  });

  describe('getDownloadPath()', () => {
    it('returns the correct path on Windows', () => {
      overridePlatform('win32');

      const result = getElectronBinaryPath('v3.0.0');
      expect(result).toBe(
        path.join('user/data/electron-bin/v3.0.0/electron.exe'),
      );
    });

    it('returns the correct path on Linux', () => {
      overridePlatform('linux');

      const result = getElectronBinaryPath('v3.0.0');
      expect(result).toBe(path.join('user/data/electron-bin/v3.0.0/electron'));
    });

    it('returns the correct path on macOS', () => {
      overridePlatform('darwin');

      const result = getElectronBinaryPath('v3.0.0');
      const expected =
        'user/data/electron-bin/v3.0.0/Electron.app/Contents/MacOS/Electron';
      expect(result).toBe(path.join(expected));
    });

    it('throws on other platforms', () => {
      overridePlatform('android');

      expect(() => getElectronBinaryPath('v3.0.0')).toThrow();
    });
  });

  describe('setupBinary()', () => {
    it('does not download local versions', async () => {
      const localPath = '/fake/path';
      (electronDownload as jest.Mock).mockResolvedValue(localPath);

      ver.source = VersionSource.local;
      ver.state = VersionState.unknown;
      await setupBinary(ver);

      expect(electronDownload).not.toHaveBeenCalled();
      expect(ver.state).toBe(VersionState.unknown);
    });

    it(`downloads a version it has not seen before`, async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      const localPath = '/fake/path';
      (electronDownload as jest.Mock).mockResolvedValue(localPath);

      ver.source = VersionSource.remote;
      ver.state = VersionState.unknown;
      await setupBinary(ver);

      expect(electronDownload).toHaveBeenCalled();
      expect(ver.state).toBe(VersionState.ready);
    });

    it('handles progress callbacks from electron/get', async () => {
      const percent = 50;

      // mock a download in progress...
      let downloadResolve: any;
      let getProgressCallback: any;
      (electronDownload as jest.Mock).mockImplementation(
        (_: any, opts: any) => {
          ({ getProgressCallback } = opts.downloadOptions);
          return new Promise((r) => (downloadResolve = r));
        },
      );

      ver.source = VersionSource.remote;
      ver.state = VersionState.unknown;
      setupBinary(ver);
      await waitFor(() => ver.state === VersionState.downloading);

      expect(ver.downloadProgress).not.toBe(percent);
      // send a progress update
      getProgressCallback({ percent });
      expect(ver.downloadProgress).toBe(percent);
      // and do it again to trigger a different if-else branch
      getProgressCallback({ percent });
      expect(ver.downloadProgress).toBe(percent);

      downloadResolve();
    });

    it(`returns the same promise if called twice for the same version`, async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const prom1 = setupBinary(ver);
      const prom2 = setupBinary(ver);

      expect(prom1).toBe(prom2);
    });

    it('handles an error in the zip file', async () => {
      (electronDownload as jest.Mock).mockReturnValue('/fake/path');
      (extract as jest.Mock).mockRejectedValue(new Error('bwap-bwap'));

      ver.source = VersionSource.remote;
      ver.state = VersionState.unknown;
      await setupBinary(ver);

      expect(extract as jest.Mock).toHaveBeenCalledTimes(1);
    });
  });
});
