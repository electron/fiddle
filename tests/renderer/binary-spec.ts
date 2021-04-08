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
import { removeTypeDefsForVersion } from '../../src/renderer/fetch-types';
import { overridePlatform, resetPlatform } from '../utils';
import { waitFor } from '../../src/utils/wait-for';

import * as path from 'path';
import * as semver from 'semver';
import extract from 'extract-zip';

jest.mock('fs-extra');
jest.mock('extract-zip');
jest.mock('../../src/renderer/ipc', () => ({}));
jest.mock('../../src/renderer/constants', () => ({
  USER_DATA_PATH: 'user/data/',
}));
jest.mock('../../src/renderer/fetch-types', () => ({
  removeTypeDefsForVersion: jest.fn(),
}));
jest.mock('@electron/get', () => ({
  download: jest.fn(),
}));

describe('binary', () => {
  let mockState: any = {};
  const fs = require('fs-extra');

  beforeEach(() => {
    mockState = {
      versions: {
        '3.0.0': {
          state: 'downloading',
        },
      },
    };
  });

  afterEach(() => {
    resetPlatform();
  });

  describe('remove()', () => {
    it('removes a version', async () => {
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await removeBinary('v3.0.0');
      expect(fs.remove).toHaveBeenCalled();
    });

    it('retries on failure', async () => {
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      (fs.remove as jest.Mock<any>).mockImplementation(() => {
        throw new Error('Bwap bwap');
      });

      await removeBinary('v3.0.0');
      expect(fs.remove).toHaveBeenCalledTimes(4);
    });

    it("attempts to clean up the version's associated typedefs", async () => {
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await removeBinary('v3.0.0');
      expect(fs.remove).toHaveBeenCalled();
      expect(removeTypeDefsForVersion).toHaveBeenCalled();
    });

    it('retries typedef cleanup upon failure', async () => {
      (removeTypeDefsForVersion as jest.Mock).mockImplementation(() => {
        throw new Error('Bwap bwap');
      });

      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await removeBinary('v3.0.0');
      expect(removeTypeDefsForVersion).toHaveBeenCalledTimes(4);
    });
  });

  describe('getVersionState()', () => {
    let version = '3.0.0';
    let ver: RunnableVersion;

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
      mockState.versions[version] = ver;
    });

    it(`returns ${VersionState.downloading} when downloading`, () => {
      // mock a download in progress
      let downloadResolve: any;
      const { download } = require('@electron/get');
      download.mockReturnValue(new Promise((r) => (downloadResolve = r)));

      setupBinary(mockState, ver.version);

      expect(getVersionState(ver)).toBe(VersionState.downloading);
      downloadResolve();
    });

    it(`returns ${VersionState.unzipping} when unzipping`, async () => {
      // mock a completed download + an unzip in progress
      const { download } = require('@electron/get');
      download.mockResolvedValueOnce('/fake/path');
      let unzipResolve: any;
      const unzipPromise = new Promise((r) => (unzipResolve = r));
      (extract as jest.Mock).mockReturnValueOnce(unzipPromise);

      setupBinary(mockState, ver.version);
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
    const { download } = require('@electron/get');

    it('does not download local versions', async () => {
      const localPath = '/fake/path';
      download.mockResolvedValue(localPath);

      const version = '3.0.0';
      mockState.versions[version] = {
        source: VersionSource.local,
        state: VersionState.unknown,
        version,
      };

      await setupBinary(mockState, version);

      expect(download).not.toHaveBeenCalled();
      expect(mockState.versions[version].state).toBe(VersionState.unknown);
    });

    it(`downloads a version it has not seen before`, async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const localPath = '/fake/path';
      download.mockResolvedValue(localPath);

      const version = '3.0.0';
      mockState.versions[version] = {
        source: VersionSource.remote,
        state: VersionState.unknown,
        version,
      };
      await setupBinary(mockState, version);

      expect(download).toHaveBeenCalled();
      expect(mockState.versions[version].state).toBe('ready');
    });

    it(`does not download a version again`, async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const version = '3.0.0';
      mockState.versions[version] = {
        source: VersionSource.remote,
        state: VersionState.unknown,
        version,
      };

      await setupBinary(mockState, version);

      expect(download).not.toHaveBeenCalled();
      expect(mockState.versions[version].state).toBe('ready');
    });

    it(`waits if asked for a version is already downloading`, async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const version = '3.0.0';
      mockState.versions[version] = {
        source: VersionSource.remote,
        state: VersionState.downloading,
        version,
      };

      await setupBinary(mockState, version);

      expect(download).not.toHaveBeenCalled();
      expect(mockState.versions[version].state).toBe('ready');
    });

    it('handles an error in the zip file', async () => {
      const { download } = require('@electron/get');

      download.mockReturnValue('/fake/path');
      const version = '3.0.0';
      mockState.versions[version] = {
        source: VersionSource.remote,
        state: VersionState.unknown,
        version,
      };

      (extract as jest.Mock).mockRejectedValue(new Error('bwap-bwap'));

      await setupBinary(mockState, 'v3.0.0');

      expect(extract as jest.Mock).toHaveBeenCalledTimes(1);
    });
  });
});
