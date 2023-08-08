import * as path from 'node:path';

import { ReleaseInfo } from '@electron/fiddle-core';
import { fetch } from 'cross-fetch';
import * as fs from 'fs-extra';
import { mocked } from 'jest-mock';
import * as tmp from 'tmp';

import {
  InstallState,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import { ElectronTypes } from '../../src/main/electron-types';
import { ElectronVersionsMock } from '../mocks/fiddle-core';
import { NodeTypesMock } from '../mocks/mocks';

jest.mock('cross-fetch');
jest.unmock('fs-extra');

const { Response } = jest.requireActual('cross-fetch');

describe('ElectronTypes', () => {
  const version = '10.11.12';
  const nodeVersion = '16.2.0';
  let remoteVersion: RunnableVersion;
  let tmpdir: tmp.DirResult;
  let electronTypes: ElectronTypes;
  let nodeTypesData: NodeTypesMock[];
  let electronVersions: ElectronVersionsMock;

  beforeEach(() => {
    tmpdir = tmp.dirSync({
      template: 'electron-fiddle-typedefs-XXXXXX',
      unsafeCleanup: true,
    });

    const nodeCacheDir = path.join(tmpdir.name, 'node-cache');
    const localDir = path.join(tmpdir.name, 'local');

    fs.ensureDirSync(nodeCacheDir);
    fs.ensureDirSync(localDir);

    remoteVersion = {
      version,
      state: InstallState.installed,
      source: VersionSource.remote,
    } as const;

    electronVersions = new ElectronVersionsMock();
    electronTypes = new ElectronTypes(electronVersions as any, nodeCacheDir);
    nodeTypesData = require('../fixtures/node-types.json');

    mocked(electronVersions.getReleaseInfo).mockReturnValue({
      node: nodeVersion,
    } as ReleaseInfo);
  });

  afterEach(async () => {
    tmpdir.removeCallback();
  });

  describe('getNodeTypes', () => {
    it('fetches types', async () => {
      mocked(fetch).mockImplementation(
        () =>
          new Response(JSON.stringify({ files: nodeTypesData }), {
            status: 200,
            statusText: 'OK',
          }),
      );

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
      mocked(fetch).mockResolvedValue(
        new Response('Cannot find package', {
          status: 404,
          statusText: 'Not Found',
        }),
      );
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
});
