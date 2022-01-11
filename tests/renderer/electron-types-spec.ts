import * as fs from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';

import { ElectronTypes } from '../../src/renderer/electron-types';
import {
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../src/interfaces';

import { MonacoMock } from '../mocks/mocks';
import { waitFor } from '../utils';

jest.unmock('fs-extra');

describe('ElectronTypes', () => {
  const version = '10.11.12';
  let addExtraLib: ReturnType<typeof jest.fn>;
  let cacheFile: string;
  let localFile: string;
  let localVersion: RunnableVersion;
  let monaco: MonacoMock;
  let remoteVersion: RunnableVersion;
  let tmpdir: tmp.DirResult;
  let electronTypes: ElectronTypes;

  beforeEach(() => {
    tmpdir = tmp.dirSync({
      template: 'electron-fiddle-typedefs-XXXXXX',
      unsafeCleanup: true,
    });
    const cacheDir = path.join(tmpdir.name, 'cache');
    const localDir = path.join(tmpdir.name, 'local');
    fs.ensureDirSync(cacheDir);
    fs.ensureDirSync(localDir);

    monaco = new MonacoMock();
    ({ addExtraLib } = monaco.languages.typescript.javascriptDefaults);

    remoteVersion = {
      version,
      state: VersionState.ready,
      source: VersionSource.remote,
    } as const;
    cacheFile = path.join(cacheDir, remoteVersion.version, 'electron.d.ts');

    localVersion = {
      version,
      localPath: localDir,
      state: VersionState.ready,
      source: VersionSource.local,
    } as const;
    localFile = path.join(localDir, 'gen/electron/tsc/typings/electron.d.ts');

    electronTypes = new ElectronTypes(monaco as any, cacheDir);
  });

  afterEach(() => {
    electronTypes.setVersion();
    tmpdir.removeCallback();
  });

  function makeFetchSpy(text: string) {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(text),
    } as any);
  }

  describe('setVersion({ source: local })', () => {
    const missingLocalVersion = {
      version,
      localPath: '/dev/null',
      state: VersionState.ready,
      source: VersionSource.local,
    } as const;

    function saveTypesFile(content: string) {
      fs.outputFileSync(localFile, content);
      return content;
    }

    it('gives types to monaco', async () => {
      const types = saveTypesFile('some types');
      await electronTypes.setVersion(localVersion);
      expect(addExtraLib).toHaveBeenCalledWith(types);
    });

    it('disposes the previous monaco content', async () => {
      // setup: call setVersion once to get some content into monaco
      const disposable = { dispose: jest.fn() };
      addExtraLib.mockReturnValue(disposable);
      const types = saveTypesFile('some types');
      await electronTypes.setVersion(localVersion);
      expect(addExtraLib).toHaveBeenCalledWith(types);
      expect(disposable.dispose).not.toHaveBeenCalled();

      // test: changing versions disposes the previous monaco content
      await electronTypes.setVersion(localVersion);
      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('watches for the types file to be updated', async () => {
      const oldTypes = saveTypesFile('some types');
      await electronTypes.setVersion(localVersion);
      expect(addExtraLib).toHaveBeenCalledWith(oldTypes);

      const newTypes = saveTypesFile('some changed types');
      expect(newTypes).not.toEqual(oldTypes);
      await waitFor(() => addExtraLib.mock.calls.length > 1);
      expect(addExtraLib).toHaveBeenCalledWith(newTypes);
    });

    it('stops watching old types files when the version changes', async () => {
      // set to version A
      let types = saveTypesFile('some types');
      await electronTypes.setVersion(localVersion);
      expect(addExtraLib).toHaveBeenCalledWith(types);

      // now switch to version B
      await electronTypes.setVersion(missingLocalVersion);
      expect(addExtraLib).toHaveBeenCalled();

      // test that updating the now-unobserved version A triggers no actions
      addExtraLib.mockReset();
      types = saveTypesFile('some changed types');
      try {
        await waitFor(() => addExtraLib.mock.calls.length > 0);
      } catch (err) {
        expect(err).toMatch(/timed out/i);
      }
      expect(addExtraLib).not.toHaveBeenCalled();
    });

    it('does not crash if the types file is missing', async () => {
      await electronTypes.setVersion(missingLocalVersion);
      expect(addExtraLib).not.toHaveBeenCalled();
    });
  });

  describe('setVersion({ source: remote })', () => {
    it('fetches types', async () => {
      const types = 'here are the types';
      const fetchSpy = makeFetchSpy(types);

      const version = { ...remoteVersion, version: '15.0.0-nightly.20210628' };
      await electronTypes.setVersion(version);
      // test that the types are fetched
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.stringMatching('electron-nightly'),
      );
      // test that setVersion calls addExtraLib with the fetched types
      expect(addExtraLib).toHaveBeenCalledTimes(1);
      expect(addExtraLib).toHaveBeenLastCalledWith(types);
    });

    it('caches fetched types', async () => {
      expect(fs.existsSync(cacheFile)).toBe(false);

      // setup: fetch and cache a .d.ts that we did not have
      const types = 'here are the types';
      const fetchSpy = makeFetchSpy(types);
      await electronTypes.setVersion(remoteVersion);
      expect(addExtraLib).toHaveBeenCalledTimes(1);
      expect(addExtraLib).toHaveBeenLastCalledWith(types);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fs.existsSync(cacheFile)).toBe(true);

      // test re-using the same version does not trigger another fetch
      // (i.e. the types are cached locally)
      await electronTypes.setVersion(remoteVersion);
      expect(addExtraLib).toHaveBeenCalledTimes(2);
      expect(addExtraLib).toHaveBeenLastCalledWith(types);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does not crash if fetch() rejects', async () => {
      const spy = jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('💩'));
      await electronTypes.setVersion(remoteVersion);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(addExtraLib).not.toHaveBeenCalled();
    });

    it('does not crash if fetch() does not find the package', async () => {
      const spy = makeFetchSpy('Cannot find package');
      await electronTypes.setVersion(remoteVersion);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(addExtraLib).not.toHaveBeenCalled();
    });
  });

  describe('uncache()', () => {
    beforeEach(async () => {
      // setup: fetch and cache some types
      expect(fs.existsSync(cacheFile)).toBe(false);
      const types = 'here are the types';
      makeFetchSpy(types);
      await electronTypes.setVersion(remoteVersion);
    });

    it('uncaches fetched types', () => {
      expect(fs.existsSync(cacheFile)).toBe(true);
      electronTypes.uncache(remoteVersion);
      expect(fs.existsSync(cacheFile)).toBe(false);
    });

    it('does not touch local builds', () => {
      expect(fs.existsSync(cacheFile)).toBe(true);
      const version = { ...remoteVersion, source: VersionSource.local };
      electronTypes.uncache(version);
      expect(fs.existsSync(cacheFile)).toBe(true);
    });
  });
});
