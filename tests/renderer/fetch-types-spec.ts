import {
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../src/interfaces';
import { USER_DATA_PATH } from '../../src/renderer/constants';
import {
  fetchTypeDefinitions,
  getDownloadedVersionTypeDefs,
  getLocalTypePathForVersion,
  getLocalVersionTypeDefs,
  getOfflineTypeDefinitionPath,
  getOfflineTypeDefinitions,
  removeTypeDefsForVersion,
  updateEditorTypeDefinitions,
} from '../../src/renderer/fetch-types';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

import * as path from 'path';
jest.mock('fs-extra');
jest.mock('extract-zip', () => {
  return jest.fn((_a, _b, c) => c());
});
jest.mock('../../src/renderer/constants', () => ({
  USER_DATA_PATH: 'user/data/',
}));
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => {
    if (p === 'fs-extra') {
      return require('fs-extra');
    }
  },
}));

describe('fetch-types', () => {
  const getMockResponse = (text: string) => ({
    text: () => text,
  });

  const mockFetch = (text = `it's me, the type definition`) => {
    (window.fetch as jest.Mock).mockResolvedValue(getMockResponse(text));
  };

  describe('fetchTypeDefinitions()', () => {
    it('fetches type definitions', async () => {
      mockFetch();

      const result = await fetchTypeDefinitions('v3.0.0');

      expect(result).toBe(`it's me, the type definition`);
    });

    it('handles errors by returning an empty string', async () => {
      const result = await fetchTypeDefinitions('v3.0.0');

      expect(result).toBe('');
    });
  });

  describe('getOfflineTypeDefinitionPath()', () => {
    it('returns a path', async () => {
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );
      expect(getOfflineTypeDefinitionPath('3.0.0')).toBe(expected);
    });
  });

  describe('getOfflineTypeDefinitions()', () => {
    it('returns true if they exist', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(true);

      const result = await getOfflineTypeDefinitions('3.0.0');
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith<any>(expected);
    });

    it('returns false if they exist', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);

      const result = await getOfflineTypeDefinitions('3.0.0');
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(result).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledWith<any>(expected);
    });
  });

  describe('getDownloadedVersionTypeDefs()', () => {
    const version = {
      state: VersionState.ready,
      source: VersionSource.remote,
      version: '3.0.0',
    };

    it('returns type definitions (and goes online if they do not exist)', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);
      mockFetch();

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(result).toBe(`it's me, the type definition`);
      expect(fs.existsSync).toHaveBeenCalledWith<any>(expected);
      expect(fetch).toHaveBeenCalled();
    });

    it('returns null if going online failed', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);
      (window.fetch as jest.Mock).mockRejectedValue({});

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(result).toBe(null);
      expect(fs.existsSync).toHaveBeenCalledWith<any>(expected);
      expect(fetch).toHaveBeenCalled();
    });

    it('tries to save them to disk if downloaded', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);
      mockFetch();

      await getDownloadedVersionTypeDefs(version);
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(fs.outputFile).toHaveBeenCalledWith<any>(
        expected,
        `it's me, the type definition`,
      );
    });

    it('returns them even if saving them failed', async () => {
      const fs = require('fs-extra');
      const def = `it's me, the type definition`;
      fs.existsSync.mockReturnValueOnce(false);
      fs.outputFile.mockImplementationOnce(() => Promise.reject());
      mockFetch();

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(fs.outputFile).toHaveBeenCalledWith<any>(expected, def);
      expect(result).toBe(def);
    });

    it('tries to read them from disk if downloaded', async () => {
      const fs = require('fs-extra');
      const def = `it's me, the type definition`;
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFile.mockImplementationOnce(() => Promise.resolve(def));
      mockFetch();

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(result).toBe(def);
      expect(fs.readFile).toHaveBeenCalledWith<any>(expected, 'utf-8');
    });

    it('returns null if downloaded but not readable', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFile.mockImplementationOnce(() => Promise.reject());
      mockFetch();

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(result).toBe(null);
      expect(fs.readFile).toHaveBeenCalledWith<any>(expected, 'utf-8');
    });
  });

  describe('getLocalVersionTypeDefs()', () => {
    let version: RunnableVersion;
    beforeEach(() => {
      version = {
        state: VersionState.ready,
        source: VersionSource.local,
        version: '3.0.0',
        localPath: 'somePath',
      };
    });

    it('fetches a local path if localPath exists', async () => {
      const fs = require('fs-extra');
      const def = `it's me, the type definition`;
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFile.mockImplementationOnce(() => Promise.resolve(def));
      const result = await getLocalVersionTypeDefs(version);
      expect(result).toEqual(def);
    });

    it('returns null for remote path', async () => {
      version.source = VersionSource.remote;
      const result = await getLocalVersionTypeDefs(version);
      expect(result).toBeNull();
    });

    it('returns null if localPath does not exist', async () => {
      version.localPath = undefined;
      const result = await getLocalVersionTypeDefs(version);
      expect(result).toBeNull();
    });
  });

  describe('getLocalTypePathForVersion()', () => {
    let version: RunnableVersion;
    beforeEach(() => {
      version = {
        state: VersionState.ready,
        source: VersionSource.local,
        version: '3.0.0',
        localPath: 'somePath',
      };
    });

    it('appends the path to the debug folder', () => {
      const result = getLocalTypePathForVersion(version);
      expect(result).toBe(
        path.join(
          'somePath',
          'gen',
          'electron',
          'tsc',
          'typings',
          'electron.d.ts',
        ),
      );
    });

    it('returns null if no localPath', () => {
      delete version.localPath;
      const result = getLocalTypePathForVersion(version);
      expect(result).toBeNull();
    });
  });

  describe('updateEditorTypeDefinitions()', () => {
    let version: RunnableVersion;
    beforeEach(() => {
      (global as any).window = window || {};
      (window as any).ElectronFiddle = new ElectronFiddleMock();
      version = {
        state: VersionState.ready,
        source: VersionSource.remote,
        version: '3.0.0',
      };
    });

    it('tries to update the editor type definitions', async () => {
      mockFetch();

      await updateEditorTypeDefinitions(version);

      const { app } = (window as any).ElectronFiddle;
      const { monaco } = app;

      expect(
        monaco.languages.typescript.javascriptDefaults.addExtraLib,
      ).toHaveBeenCalled();
    });

    it('it waits for Monaco to show up', async () => {
      mockFetch();

      const { app } = (window as any).ElectronFiddle;
      const { monaco } = app;

      (window as any).ElectronFiddle = {};

      setTimeout(() => {
        window.ElectronFiddle.app = app;
      }, 300);

      await updateEditorTypeDefinitions(version);

      expect(
        monaco.languages.typescript.javascriptDefaults.addExtraLib,
      ).toHaveBeenCalled();
    });

    it('it does not wait forever', async () => {
      (window as any).ElectronFiddle = {};

      await updateEditorTypeDefinitions(version, 11);
    });

    it('handles definitions not existing', async () => {
      (window.fetch as jest.Mock).mockResolvedValue(null);

      let errored = false;

      try {
        await updateEditorTypeDefinitions(version, 11);
      } catch (error) {
        errored = true;
      }

      expect(errored).toBe(false);
    });
  });

  describe('removeTypeDefsForVersion()', () => {
    it("removes a version's typedefs", async () => {
      const fs = require('fs-extra');
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      await removeTypeDefsForVersion('v3.0.0');
      expect(fs.remove).toHaveBeenCalledWith<any>(
        path.join(USER_DATA_PATH, 'electron-typedef', '3.0.0'),
      );
    });

    it('throws upon fs failure', async () => {
      const fs = require('fs-extra');
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      (fs.remove as jest.Mock<any>).mockImplementation(() => {
        throw new Error('Bwap bwap');
      });

      expect.assertions(1);

      try {
        await removeTypeDefsForVersion('v3.0.0');
      } catch (e) {
        expect(e).toEqual(new Error('Bwap bwap'));
      }
    });
  });
});
