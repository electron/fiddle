import {
  getDownloadedVersions,
  getDownloadingVersions,
  getElectronBinaryPath,
  removeBinary,
  setupBinary,
} from '../../src/renderer/binary';
import { removeTypeDefsForVersion } from '../../src/renderer/fetch-types';
import { overridePlatform, resetPlatform } from '../utils';

import * as path from 'path';
import extract from 'extract-zip';

jest.mock('fs-extra');
jest.mock('extract-zip');
jest.mock('../../src/renderer/ipc', () => ({}));
jest.mock('../../src/renderer/constants', () => ({
  USER_DATA_PATH: 'user/data/',
}));
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => {
    if (p === 'extract-zip') {
      return { default: require('extract-zip') };
    }
    throw new Error(`Unexpected module '${p}'`);
  },
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

  describe('getDownloadedVersions()', () => {
    it('finds downloaded versions', async () => {
      const versions = ['v3.0.0'];
      (fs.readdir as jest.Mock<any>).mockResolvedValue(versions);
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      const result = await getDownloadedVersions();
      expect(result).toEqual(versions);
    });

    it('is okay without versions ', async () => {
      const versions: string[] = [];
      (fs.readdir as jest.Mock<any>).mockResolvedValue(versions);
      const result = await getDownloadedVersions();
      expect(result).toEqual(versions);
    });

    it('is okay without versions and with errors', async () => {
      (fs.readdir as jest.Mock<any>).mockRejectedValueOnce('💩');
      const result = await getDownloadedVersions();
      expect(result).toEqual([]);
    });
  });

  describe('getDownloadingVersions()', () => {
    it('returns currently downloading versions', () => {
      const result = getDownloadingVersions(mockState as any);
      expect(result).toEqual(['3.0.0']);
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

    it(`downloads a version it has not seen before`, async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const localPath = '/fake/path';
      download.mockResolvedValue(localPath);

      const version = '3.0.0';
      mockState.versions[version] = { state: 'unknown' };
      await setupBinary(mockState, version);

      expect(download).toHaveBeenCalled();
      expect(mockState.versions[version].state).toBe('ready');
    });

    it(`does not download a version again`, async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const version = '3.0.0';
      mockState.versions[version] = { state: 'unknown' };

      await setupBinary(mockState, version);

      expect(download).not.toHaveBeenCalled();
      expect(mockState.versions[version].state).toBe('ready');
    });

    it(`waits if asked for a version is already downloading`, async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const version = '3.0.0';
      mockState.versions[version] = { state: 'downloading' };
      await setupBinary(mockState, version);

      expect(download).not.toHaveBeenCalled();
      expect(mockState.versions[version].state).toBe('ready');
    });

    it('handles an error in the zip file', async () => {
      const { download } = require('@electron/get');

      download.mockReturnValue('/fake/path');
      mockState.versions['3.0.0'] = { state: 'unknown' };

      (extract as jest.Mock).mockRejectedValue(new Error('bwap-bwap'));

      await setupBinary(mockState, 'v3.0.0');

      expect(extract as jest.Mock).toHaveBeenCalledTimes(1);
    });
  });
});
