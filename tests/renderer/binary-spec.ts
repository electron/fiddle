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

jest.mock('fs-extra');
jest.mock('../../src/renderer/ipc', () => ({}));
jest.mock('extract-zip', () => {
  return jest.fn((_a, _b) => Promise.resolve());
});
jest.mock('../../src/renderer/constants', () => ({
  USER_DATA_PATH: 'user/data/',
}));
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => {
    if (p === 'fs-extra') {
      return require('fs-extra');
    }
    if (p === 'extract-zip') {
      return { default: require('extract-zip') };
    }
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
      const fs = require('fs-extra');

      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await removeBinary('v3.0.0');
      expect(fs.remove).toHaveBeenCalled();
    });

    it('retries on failure', async () => {
      const fs = require('fs-extra');

      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      (fs.remove as jest.Mock<any>).mockImplementation(() => {
        throw new Error('Bwap bwap');
      });

      await removeBinary('v3.0.0');
      expect(fs.remove).toHaveBeenCalledTimes(4);
    });

    it("attempts to clean up the version's associated typedefs", async () => {
      const fs = require('fs-extra');

      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      await removeBinary('v3.0.0');
      expect(fs.remove).toHaveBeenCalled();
      expect(removeTypeDefsForVersion).toHaveBeenCalled();
    });

    it('retries typedef cleanup upon failure', async () => {
      const fs = require('fs-extra');
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
      const fs = require('fs-extra');

      (fs.readdir as jest.Mock<any>).mockReturnValue(['v3.0.0']);
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      const result = await getDownloadedVersions();

      expect(result).toEqual(['v3.0.0']);
    });

    it('is okay without versions ', async () => {
      const fs = require('fs-extra');

      (fs.readdir as jest.Mock<any>).mockReturnValue([]);
      const result = await getDownloadedVersions();
      expect(result).toEqual([]);
    });

    it('is okay without versions and with errors', async () => {
      const fs = require('fs-extra');

      (fs.readdir as jest.Mock<any>).mockImplementationOnce(() => {
        throw new Error('💩');
      });
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
      overridePlatform('bleepbloop');

      expect(() => getElectronBinaryPath('v3.0.0')).toThrow();
    });
  });

  describe('setupBinary()', () => {
    it(`downloads a version it hasn't seen before`, async () => {
      const { download } = require('@electron/get');
      download.mockReturnValue('/fake/path');

      mockState.versions['3.0.0'] = { state: 'unknown' };
      await setupBinary(mockState, 'v3.0.0');

      expect(download).toHaveBeenCalled();
      expect(mockState.versions['3.0.0'].state).toBe('ready');
    });

    it(`does not download a version again`, async () => {
      const fs = require('fs-extra');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const { download } = require('@electron/get');

      mockState.versions['3.0.0'] = { state: 'unknown' };
      await setupBinary(mockState, 'v3.0.0');

      expect(download).toHaveBeenCalledTimes(0);
      expect(mockState.versions['3.0.0'].state).toBe('ready');
    });

    it(`does not download a version while already downloading`, async () => {
      const fs = require('fs-extra');
      const { download } = require('@electron/get');

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      mockState.versions['3.0.0'].state = 'downloading';

      await setupBinary(mockState, 'v3.0.0');

      expect(download).toHaveBeenCalledTimes(0);
      expect(mockState.versions['3.0.0'].state).toBe('downloading');
    });

    it('handles an error in the zip file', async () => {
      const { download } = require('@electron/get');
      download.mockReturnValue('/fake/path');

      const mockZip = require('extract-zip');
      mockZip.mockImplementationOnce((_a: any, _b: any, c: any) =>
        c(new Error('bwap-bwap')),
      );

      await setupBinary(mockState, 'v3.0.0');
    });
  });
});
