import * as path from 'node:path';

import { ElectronVersions, ReleaseInfo } from '@electron/fiddle-core';
import type { BrowserWindow } from 'electron';
import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';
import * as tmp from 'tmp';

import {
  InstallState,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';
import { ElectronTypes } from '../../src/main/electron-types';
import { ipcMainManager } from '../../src/main/ipc';
import { ElectronVersionsMock } from '../mocks/fiddle-core';
import { BrowserWindowMock, NodeTypesMock } from '../mocks/mocks';
import { waitFor } from '../utils';

jest.mock('../../src/main/ipc');
jest.unmock('fs-extra');

describe('ElectronTypes', () => {
  const version = '10.11.12';
  const nodeVersion = '16.2.0';
  let cacheFile: string;
  let localFile: string;
  let localVersion: RunnableVersion;
  let remoteVersion: RunnableVersion;
  let tmpdir: tmp.DirResult;
  let electronTypes: ElectronTypes;
  let nodeTypesData: NodeTypesMock[];
  let electronVersions: ElectronVersionsMock;
  let browserWindow: BrowserWindow;

  beforeEach(() => {
    tmpdir = tmp.dirSync({
      template: 'electron-fiddle-typedefs-XXXXXX',
      unsafeCleanup: true,
    });

    const electronCacheDir = path.join(tmpdir.name, 'electron-cache');
    const nodeCacheDir = path.join(tmpdir.name, 'node-cache');
    const localDir = path.join(tmpdir.name, 'local');

    fs.ensureDirSync(nodeCacheDir);
    fs.ensureDirSync(localDir);

    remoteVersion = {
      version,
      state: InstallState.installed,
      source: VersionSource.remote,
    } as const;
    cacheFile = path.join(
      electronCacheDir,
      remoteVersion.version,
      'electron.d.ts',
    );

    localVersion = {
      version,
      localPath: localDir,
      state: InstallState.installed,
      source: VersionSource.local,
    } as const;
    localFile = path.join(localDir, 'gen/electron/tsc/typings/electron.d.ts');
    fs.ensureDirSync(path.dirname(localFile));

    electronVersions = new ElectronVersionsMock();
    electronTypes = new ElectronTypes(
      electronVersions as unknown as ElectronVersions,
      electronCacheDir,
      nodeCacheDir,
    );
    nodeTypesData = require('../fixtures/node-types.json');

    mocked(electronVersions.getReleaseInfo).mockReturnValue({
      node: nodeVersion,
    } as ReleaseInfo);

    browserWindow = new BrowserWindowMock() as unknown as BrowserWindow;
  });

  afterEach(async () => {
    electronTypes.unwatch(browserWindow);
    tmpdir.removeCallback();
    mocked(fetch).mockReset();
  });

  describe('getElectronTypes({ source: local })', () => {
    const missingLocalVersion = {
      version,
      localPath: '/dev/null',
      state: InstallState.installed,
      source: VersionSource.local,
    } as const;

    function saveTypesFile(content: string) {
      fs.writeFileSync(localFile, content, { flush: true });
      return content;
    }

    it('watches for the types file to be updated', async () => {
      const oldTypes = saveTypesFile('some types');
      await expect(
        electronTypes.getElectronTypes(browserWindow, localVersion),
      ).resolves.toBe(oldTypes);

      const newTypes = saveTypesFile('some changed types');
      expect(newTypes).not.toEqual(oldTypes);
      await waitFor(() => mocked(ipcMainManager).send.mock.calls.length > 0);
      expect(ipcMainManager.send).toHaveBeenCalledWith(
        IpcEvents.ELECTRON_TYPES_CHANGED,
        [newTypes, localVersion.version],
        browserWindow.webContents,
      );
    });

    it('stops watching old types files when the version changes', async () => {
      // set to version A
      let types = saveTypesFile('some types');
      await expect(
        electronTypes.getElectronTypes(browserWindow, localVersion),
      ).resolves.toBe(types);

      // now switch to version B
      await electronTypes.getElectronTypes(browserWindow, missingLocalVersion);

      // test that updating the now-unobserved version A triggers no actions
      types = saveTypesFile('some changed types');
      try {
        await waitFor(() => mocked(ipcMainManager).send.mock.calls.length > 0);
      } catch (err) {
        expect(err).toMatch(/timed out/i);
      }
      expect(ipcMainManager.send).not.toHaveBeenCalled();
    });

    it('does not crash if the types file is missing', async () => {
      await expect(
        electronTypes.getElectronTypes(browserWindow, missingLocalVersion),
      ).resolves.toBe(undefined);
    });
  });

  describe('getElectronTypes({ source: remote })', () => {
    it('fetches types', async () => {
      const version = { ...remoteVersion, version: '15.0.0-nightly.20210628' };
      const types = 'here are the types';
      mocked(fetch).mockResolvedValue({
        text: jest.fn().mockResolvedValue(types),
        json: jest.fn().mockImplementation(async () => JSON.parse(types)),
        ok: true,
        status: 200,
        statusText: 'OK',
      } as unknown as Response);

      await expect(
        electronTypes.getElectronTypes(browserWindow, version),
      ).resolves.toEqual(types);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching('electron-nightly'),
      );
    });

    it('caches fetched types', async () => {
      expect(fs.existsSync(cacheFile)).toBe(false);

      // setup: fetch and cache a .d.ts that we did not have
      const types = 'here are the types';
      mocked(fetch).mockResolvedValue({
        text: jest.fn().mockResolvedValue(types),
        json: jest.fn().mockImplementation(async () => JSON.parse(types)),
        ok: true,
        status: 200,
        statusText: 'OK',
      } as unknown as Response);
      await expect(
        electronTypes.getElectronTypes(browserWindow, remoteVersion),
      ).resolves.toEqual(types);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fs.existsSync(cacheFile)).toBe(true);

      // test re-using the same version does not trigger another fetch
      // (i.e. the types are cached locally)
      await electronTypes.getElectronTypes(browserWindow, remoteVersion);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('does not crash if fetch() rejects', async () => {
      mocked(fetch).mockRejectedValue(new Error('💩'));
      await expect(
        electronTypes.getElectronTypes(browserWindow, remoteVersion),
      ).resolves.toBe(undefined);
      expect(fetch).toHaveBeenCalled();
    });

    it('does not crash if fetch() does not find the package', async () => {
      mocked(fetch).mockResolvedValue({
        text: jest.fn().mockResolvedValue('Cannot find package'),
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as unknown as Response);
      await expect(
        electronTypes.getElectronTypes(browserWindow, remoteVersion),
      ).resolves.toBe(undefined);
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('getNodeTypes', () => {
    it('fetches types', async () => {
      const content = JSON.stringify({ files: nodeTypesData });
      mocked(fetch).mockResolvedValue({
        text: jest.fn().mockResolvedValue(content),
        json: jest.fn().mockImplementation(async () => JSON.parse(content)),
        ok: true,
        status: 200,
        statusText: 'OK',
      } as unknown as Response);

      const version = { ...remoteVersion, version: '15.0.0-nightly.20210628' };
      await expect(
        electronTypes.getNodeTypes(version.version),
      ).resolves.toEqual({ types: expect.anything(), version: nodeVersion });

      expect(fetch).toHaveBeenCalledTimes(nodeTypesData.length);

      for (const file of nodeTypesData.filter(({ path }) =>
        path.endsWith('.d.ts'),
      )) {
        expect(fetch).toHaveBeenCalledWith(expect.stringMatching(file.path));
      }
    });

    it('does not crash if fetch() rejects', async () => {
      mocked(fetch).mockRejectedValue(new Error('💩'));
      await expect(
        electronTypes.getNodeTypes(remoteVersion.version),
      ).resolves.toBe(undefined);
      expect(fetch).toHaveBeenCalled();
    });

    it('does not crash if fetch() does not find the package', async () => {
      mocked(fetch).mockResolvedValue({
        text: jest.fn().mockResolvedValue('Cannot find package'),
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as unknown as Response);
      await expect(
        electronTypes.getNodeTypes(remoteVersion.version),
      ).resolves.toBe(undefined);
      expect(fetch).toHaveBeenCalled();
    });

    it('does not crash if no release info', async () => {
      mocked(electronVersions.getReleaseInfo).mockReturnValue(undefined);

      await expect(
        electronTypes.getNodeTypes(remoteVersion.version),
      ).resolves.toBe(undefined);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('uncache', () => {
    beforeEach(async () => {
      // setup: fetch and cache some types
      expect(fs.existsSync(cacheFile)).toBe(false);
      const types = 'here are the types';
      const content = JSON.stringify({ files: types });
      mocked(fetch).mockResolvedValue({
        text: jest.fn().mockResolvedValue(content),
        json: jest.fn().mockImplementation(async () => JSON.parse(content)),
        ok: true,
        status: 200,
        statusText: 'OK',
      } as unknown as Response);
      await electronTypes.getElectronTypes(browserWindow, remoteVersion);
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
