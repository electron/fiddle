
import {
  ElectronVersion,
  ElectronVersionSource,
  ElectronVersionState
} from '../../src/interfaces';

import {
  fetchTypeDefinitions,
  getDownloadedVersionTypeDefs,
  getLocalTypePathForVersion,
  getLocalVersionTypeDefs,
  getOfflineTypeDefinitionPath,
  getOfflineTypeDefinitions,
  updateEditorTypeDefinitions
} from '../../src/renderer/fetch-types';

import * as path from 'path';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

jest.mock('fs-extra');
jest.mock('extract-zip', () => {
  return jest.fn((_a, _b, c) => c());
});
jest.mock('../../src/renderer/constants', () => ({
  USER_DATA_PATH: 'user/data/'
}));
jest.mock('../../src/utils/import', () => ({
  fancyImport: async (p: string) => {
    if (p === 'fs-extra') {
      return require('fs-extra');
    }
  }
}));

describe('fetch-types', () => {
  describe('fetchTypeDefinitions()', () => {
    it('fetches type definitions', async () => {
      (fetch as any).mockResponse(`it's me, the type definition`);
      const result = await fetchTypeDefinitions('v3.0.0');

      expect(result).toBe(`it's me, the type definition`);
    });

    it('handles errors by returning an empty string', async () => {
      (fetch as any).mockReject();
      const result = await fetchTypeDefinitions('v3.0.0');

      expect(result).toBe('');
    });
  });

  describe('getOfflineTypeDefinitionPath()', () => {
    it('returns a path', async () => {
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');
      expect(getOfflineTypeDefinitionPath('3.0.0')).toBe(expected);
    });
  });

  describe('getOfflineTypeDefinitions()', () => {
    it('returns true if they exist', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(true);

      const result = await getOfflineTypeDefinitions('3.0.0');
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(expected);
    });

    it('returns false if they exist', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);

      const result = await getOfflineTypeDefinitions('3.0.0');
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');

      expect(result).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledWith(expected);
    });
  });

  describe('getDownloadedVersionTypeDefs()', () => {
    const version = {
      state: ElectronVersionState.ready,
      source: ElectronVersionSource.remote,
      version: '3.0.0'
    };

    it('returns type definitions (and goes online if they do not exist)', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);
      (fetch as any).mockResponse(`it's me, the type definition`);

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');

      expect(result).toBe(`it's me, the type definition`);
      expect(fs.existsSync).toHaveBeenCalledWith(expected);
      expect(fetch).toHaveBeenCalled();
    });

    it('returns null if going online failed', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);
      (fetch as any).mockReject();

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');

      expect(result).toBe(null);
      expect(fs.existsSync).toHaveBeenCalledWith(expected);
      expect(fetch).toHaveBeenCalled();
    });

    it('tries to save them to disk if downloaded', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(false);
      (fetch as any).mockResponse(`it's me, the type definition`);

      await getDownloadedVersionTypeDefs(version);
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');

      expect(fs.outputFile).toHaveBeenCalledWith(expected, `it's me, the type definition`);
    });

    it('returns them even if saving them failed', async () => {
      const fs = require('fs-extra');
      const def = `it's me, the type definition`;
      fs.existsSync.mockReturnValueOnce(false);
      fs.outputFile.mockImplementationOnce(() => Promise.reject());
      (fetch as any).mockResponse(def);

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');

      expect(fs.outputFile).toHaveBeenCalledWith(expected, def);
      expect(result).toBe(def);
    });

    it('tries to read them from disk if downloaded', async () => {
      const fs = require('fs-extra');
      const def = `it's me, the type definition`;
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFile.mockImplementationOnce(() => Promise.resolve(def));
      (fetch as any).mockResponse(`it's me, the type definition`);

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');

      expect(result).toBe(def);
      expect(fs.readFile).toHaveBeenCalledWith(expected, 'utf-8');
    });

    it('returns null if downloaded but not readable', async () => {
      const fs = require('fs-extra');
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFile.mockImplementationOnce(() => Promise.reject());
      (fetch as any).mockResponse(`it's me, the type definition`);

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join('user/data/electron-typedef/3.0.0/electron.d.ts');

      expect(result).toBe(null);
      expect(fs.readFile).toHaveBeenCalledWith(expected, 'utf-8');
    });
  });

  describe('getLocalVersionTypeDefs()', () => {
    let version: ElectronVersion;
    beforeEach(() => {
      version = {
        state: ElectronVersionState.ready,
        source: ElectronVersionSource.local,
        version: '3.0.0',
        localPath: 'somePath'
      };
    });

    it('fetches a local path if localPath exists',  async () => {
      const fs = require('fs-extra');
      const def = `it's me, the type definition`;
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFile.mockImplementationOnce(() => Promise.resolve(def));
      const result = await getLocalVersionTypeDefs(version);
      expect(result).toEqual(def);
    });

    it('returns null for remote path',  async () => {
      version.source = ElectronVersionSource.remote;
      const result = await getLocalVersionTypeDefs(version);
      expect(result).toBeNull();
    });

    it('returns null if localPath does not exist',  async () => {
      version.localPath = undefined;
      const result = await getLocalVersionTypeDefs(version);
      expect(result).toBeNull();
    });
  });

  describe('getLocalTypePathForVersion()', () => {
    let version: ElectronVersion;
    beforeEach(() => {
      version = {
        state: ElectronVersionState.ready,
        source: ElectronVersionSource.local,
        version: '3.0.0',
        localPath: 'somePath'
      };
    });

    it('appends the path to the debug folder', () => {
      const result = getLocalTypePathForVersion(version);
      expect(result).toBe(path.join(
        'somePath',
        'gen',
        'electron',
        'tsc',
        'typings',
        'electron.d.ts'
      ));
    });

    it('returns null if no localPath', () => {
      delete version.localPath;
      const result = getLocalTypePathForVersion(version);
      expect(result).toBeNull();
    });
  });

  describe('updateEditorTypeDefinitions()', () => {
    let version: ElectronVersion;
    beforeEach(() => {
      (global as any).window = window || {};
      (window as any).ElectronFiddle = new ElectronFiddleMock();
      version = {
        state: ElectronVersionState.ready,
        source: ElectronVersionSource.remote,
        version: '3.0.0'
      };
    });

    it('tries to update the editor type definitions', async () => {
      (fetch as any).mockResponse(`it's me, the type definition`);

      await updateEditorTypeDefinitions(version);

      const { app } = (window as any).ElectronFiddle;
      const { monaco } = app;

      expect(monaco.languages.typescript.javascriptDefaults.addExtraLib)
        .toHaveBeenCalled();
    });

    it('it waits for Monaco to show up', async () => {
      (fetch as any).mockResponse(`it's me, the type definition`);

      const { app } = (window as any).ElectronFiddle;
      const { monaco } = app;

      (window as any).ElectronFiddle = {};

      setTimeout(() => {
        window.ElectronFiddle.app = app;
      }, 300);

      await updateEditorTypeDefinitions(version);

      expect(monaco.languages.typescript.javascriptDefaults.addExtraLib)
        .toHaveBeenCalled();
    });

    it('it does not wait forever', async () => {
      (window as any).ElectronFiddle = {};

      await updateEditorTypeDefinitions(version, 11);
    });

    it('handles definitions not existing', async () => {
      (fetch as any).mockResponse(null);

      let errored = false;

      try {
        await updateEditorTypeDefinitions(version, 11);
      } catch (error) {
        errored = true;
      }

      expect(errored).toBe(false);
    });
  });
});
