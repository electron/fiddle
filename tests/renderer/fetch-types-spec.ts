import * as fs from 'fs-extra';
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
    it('returns a path', () => {
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );
      expect(getOfflineTypeDefinitionPath('3.0.0')).toBe(expected);
    });
  });

  describe('getOfflineTypeDefinitions()', () => {
    it('returns true if they exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);

      const result = getOfflineTypeDefinitions('3.0.0');
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith<any>(expected);
    });

    it('returns false if they exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const result = getOfflineTypeDefinitions('3.0.0');
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
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
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
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
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
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
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
      const def = `it's me, the type definition`;
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      (fs.outputFile as jest.Mock).mockRejectedValue(0);
      mockFetch();

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(fs.outputFile).toHaveBeenCalledWith<any>(expected, def);
      expect(result).toBe(def);
    });

    it('tries to read them from disk if downloaded', async () => {
      const def = `it's me, the type definition`;
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFile as jest.Mock).mockResolvedValue(def);
      mockFetch();

      const result = await getDownloadedVersionTypeDefs(version);
      const expected = path.join(
        'user/data/electron-typedef/3.0.0/electron.d.ts',
      );

      expect(result).toBe(def);
      expect(fs.readFile).toHaveBeenCalledWith<any>(expected, 'utf-8');
    });

    it('returns null if downloaded but not readable', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFile as jest.Mock).mockRejectedValue(null);
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
      const def = `it's me, the type definition`;
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFile as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve(def),
      );
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
      const { monaco } = (window as any).ElectronFiddle;

      expect(
        monaco.languages.typescript.javascriptDefaults.addExtraLib,
      ).toHaveBeenCalled();
    });

    it('handles definitions not existing', async () => {
      (window.fetch as jest.Mock).mockResolvedValue(null);

      let errored = false;

      try {
        await updateEditorTypeDefinitions(version);
      } catch (error) {
        errored = true;
      }

      expect(errored).toBe(false);
    });
  });

  describe('removeTypeDefsForVersion()', () => {
    it("removes a version's typedefs", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      await removeTypeDefsForVersion('v3.0.0');
      expect(fs.remove).toHaveBeenCalledWith<any>(
        path.join(USER_DATA_PATH, 'electron-typedef', '3.0.0'),
      );
    });

    it('throws upon fs failure', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.remove as jest.Mock).mockImplementation(() => {
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
