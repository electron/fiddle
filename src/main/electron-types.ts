import * as path from 'node:path';

import { ElectronVersions } from '@electron/fiddle-core';
import fetch from 'cross-fetch';
import { IpcMainEvent, app } from 'electron';
import * as fs from 'fs-extra';
import packageJson from 'package-json';
import readdir from 'recursive-readdir';
import semver from 'semver';

import { ipcMainManager } from './ipc';
import { NodeTypes } from '../interfaces';
import { IpcEvents } from '../ipc-events';

let electronTypes: ElectronTypes;

export class ElectronTypes {
  constructor(
    private readonly knownVersions: ElectronVersions,
    private readonly nodeCacheDir: string,
  ) {}

  public async getNodeTypes(
    version: string,
  ): Promise<{ version: string; types: NodeTypes } | undefined> {
    // Get the Node.js version corresponding to the current Electron version.
    const v = this.knownVersions.getReleaseInfo(version)?.node;

    if (!v) return;

    try {
      const dir = this.getCacheDir(v);
      const ver = await this.cacheAndReturnNodeTypesVersion(v, dir);

      return { version: ver, types: await this.getTypesFromDir(dir) };
    } catch (err) {
      console.debug(
        `Unable to get Node.js types for Electron "${version}": ${err.message}`,
      );
      return;
    }
  }

  private async getTypesFromDir(dir: string): Promise<NodeTypes> {
    const types: NodeTypes = {};

    try {
      const files = (await readdir(dir)).filter((f) => f.endsWith('.d.ts'));

      for (const file of files) {
        types[path.relative(dir, file) as keyof NodeTypes] = fs.readFileSync(
          file,
          'utf8',
        );
      }
    } catch (err) {
      console.debug(`Unable to read types from "${dir}": ${err.message}`);
    }

    return types;
  }

  private getCacheDir(version: string) {
    return path.join(this.nodeCacheDir, version);
  }

  /**
   * This function ensures that the Node.js version for a given version of
   * Electron is downloaded and cached. It can be the case that DefinitelyTyped
   * doesn't have specific Node.js versions, and if it's missing a certain version,
   * we instead download the most recent version of Node.js in that release line older
   * than the target version and return that. This also allows Electron versions to share
   * versions of Node.js types.
   *
   * @param version - version of Node.js to fetch types for.
   * @param dir - directory where the Node.js types version may be stored.
   * @returns the version of Node.js types for this version of Electron.
   */
  private async cacheAndReturnNodeTypesVersion(version: string, dir: string) {
    if (fs.existsSync(dir)) return version;

    let downloadVersion = version;
    let response = await fetch(
      `https://unpkg.com/@types/node@${version}/?meta`,
    );

    if (response.status === 404) {
      const types = await packageJson('@types/node', {
        version: semver.major(version).toString(),
        fullMetadata: false,
      });

      downloadVersion = types.version as string;
      console.log(
        `falling back to the latest applicable Node.js version type: ${downloadVersion}`,
      );

      const maybeCachedDir = path.join(this.nodeCacheDir, downloadVersion);
      if (fs.existsSync(maybeCachedDir)) return downloadVersion;

      response = await fetch(
        `https://unpkg.com/@types/node@${downloadVersion}/?meta`,
      );
    }

    const { files: fileJson } = (await response.json()) as {
      files: { path: string }[];
    };
    await Promise.all(
      fileJson
        .flatMap((item: { files?: { path: string }[]; path: string }) => {
          return item.files ? item.files.map((f: any) => f.path) : item.path;
        })
        .filter((path: string) => path.endsWith('.d.ts'))
        .map(async (path: string) => {
          const res = await fetch(
            `https://unpkg.com/@types/node@${downloadVersion}${path}`,
          );
          const text = await res.text();
          fs.outputFileSync(`${dir}${path}`, text);
        }),
    );

    return downloadVersion;
  }
}

export async function setupTypes(knownVersions: ElectronVersions) {
  const userDataPath = app.getPath('userData');

  electronTypes = new ElectronTypes(
    knownVersions,
    path.join(userDataPath, 'nodejs-typedef'),
  );

  ipcMainManager.handle(
    IpcEvents.GET_NODE_TYPES,
    (_: IpcMainEvent, version: string) => {
      return electronTypes.getNodeTypes(version);
    },
  );
}
