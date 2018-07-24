import { BinaryManager } from '../../src/renderer/binary';
import { resetPlatform, overridePlatform } from '../utils';

import * as path from 'path';

jest.mock('fs-extra');
jest.mock('extract-zip', () => {
  return jest.fn((_a, _b, c) => c());
});
jest.mock('../../src/constants', () => ({
  USER_DATA_PATH: 'user/data/'
}));
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => {
    if (p === 'fs-extra') {
      return require('fs-extra');
    }
    if (p === 'extract-zip') {
      return { default: require('extract-zip') };
    }
  }
}));
jest.mock('electron-download', () => {
  return jest.fn();
});

describe('binary', () => {
  let binaryManager = new BinaryManager();

  beforeEach(() => {
    binaryManager = new BinaryManager();
  });

  afterEach(() => {
    resetPlatform();
  });

  describe('remove()', () => {
    it('removes a version', async () => {
      const fs = require('fs-extra');

      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await binaryManager.remove('v3.0.0');
      expect(fs.remove).toHaveBeenCalled();
    });

    it('retries on failure', async () => {
      const fs = require('fs-extra');

      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      (fs.remove as jest.Mock<any>).mockImplementation(() => {
        throw new Error('Bwap bwap');
      });

      await binaryManager.remove('v3.0.0');
      expect(fs.remove).toHaveBeenCalledTimes(4);
    });
  });

  describe('getDownloadedVersions()', () => {
    it('finds downloaded versions', async () => {
      const fs = require('fs-extra');

      (fs.readdir as jest.Mock<any>).mockReturnValue([ 'v3.0.0' ]);
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      const result = await binaryManager.getDownloadedVersions();

      expect(result).toEqual([ 'v3.0.0' ]);
    });

    it('is okay without versions ', async () => {
      const fs = require('fs-extra');

      (fs.readdir as jest.Mock<any>).mockReturnValue([]);
      const result = await binaryManager.getDownloadedVersions();
      expect(result).toEqual([]);
    });

    it('is okay without versions and with errors', async () => {
      const fs = require('fs-extra');

      (fs.readdir as jest.Mock<any>).mockImplementationOnce(() => {
        throw new Error('💩');
      });
      const result = await binaryManager.getDownloadedVersions();
      expect(result).toEqual([]);
    });
  });

  describe('getDownloadPath()', () => {
    it('returns the correct path on Windows', () => {
      overridePlatform('win32');

      const result = binaryManager.getElectronBinaryPath('v3.0.0');
      expect(result).toBe(path.join('user/data/electron-bin/v3.0.0/electron.exe'));
    });

    it('returns the correct path on Linux', () => {
      overridePlatform('linux');

      const result = binaryManager.getElectronBinaryPath('v3.0.0');
      expect(result).toBe(path.join('user/data/electron-bin/v3.0.0/electron'));
    });

    it('returns the correct path on macOS', () => {
      overridePlatform('darwin');

      const result = binaryManager.getElectronBinaryPath('v3.0.0');
      const expected = 'user/data/electron-bin/v3.0.0/Electron.app/Contents/MacOS/Electron';
      expect(result).toBe(path.join(expected));
    });

    it('throws on other platforms', () => {
      overridePlatform('bleepbloop');

      expect(() => binaryManager.getElectronBinaryPath('v3.0.0'))
        .toThrow();
    });
  });

  describe('setup()', () => {
    it(`downloads a version it hasn't seen before`, async () => {
      const eDownload = require('electron-download');
      eDownload.mockImplementationOnce((p, c) => c(undefined, '/fake/path'));

      await binaryManager.setup('v3.0.0');

      expect(binaryManager.state['3.0.0']).toBe('ready');
    });
  });
});
