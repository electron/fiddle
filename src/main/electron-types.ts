import { readdir } from 'fs/promises';
import * as path from 'node:path';

import { ElectronVersions } from '@electron/fiddle-core';
import { BrowserWindow, IpcMainEvent, app } from 'electron';
import * as fs from 'fs-extra';
import watch from 'node-watch';
import packageJson from 'package-json';
import semver from 'semver';

import { ipcMainManager } from './ipc';
import { ELECTRON_DTS } from '../constants';
import { NodeTypes, RunnableVersion, VersionSource } from '../interfaces';
import { IpcEvents } from '../ipc-events';

let electronTypes: ElectronTypes;

export class ElectronTypes {
  private localPaths: Map<BrowserWindow, string>;
  private watchers: Map<string, fs.FSWatcher>;

  constructor(
    private readonly knownVersions: ElectronVersions,
    private readonly electronCacheDir: string,
    private readonly nodeCacheDir: string,
  ) {
    this.localPaths = new Map();
    this.watchers = new Map();
  }

  private getWindowsForLocalPath(localPath: string): BrowserWindow[] {
    return Array.from(this.localPaths.entries())
      .filter(([, path]) => path === localPath)
      .map(([window]) => window);
  }

  private notifyElectronTypesChanged(
    dir: string,
    file: string,
    version: string,
  ) {
    try {
      const content = fs.readFileSync(file, 'utf8');

      // Notify all windows watching that path
      for (const window of this.getWindowsForLocalPath(dir)) {
        ipcMainManager.send(
          IpcEvents.ELECTRON_TYPES_CHANGED,
          [content, version],
          window.webContents,
        );
      }
    } catch (err) {
      console.debug(`Unable to read types from "${file}": ${err.message}`);
    }
  }

  public async getElectronTypes(
    window: BrowserWindow,
    ver: RunnableVersion,
  ): Promise<string | undefined> {
    const { localPath: dir, source, version } = ver;
    let content: string | undefined;

    // If it's a local development version, pull Electron types from out directory.
    if (dir) {
      const file = path.join(dir, 'gen/electron/tsc/typings', ELECTRON_DTS);
      content = this.getTypesFromFile(file);
      try {
        this.unwatch(window);
        this.localPaths.set(window, dir);

        // If no watcher for that path yet, create it
        if (!this.watchers.has(dir)) {
          const watcher = watch(file, () =>
            this.notifyElectronTypesChanged(dir, file, version),
          );
          this.watchers.set(dir, watcher);
        }
        window.once('close', () => this.unwatch(window));
      } catch (err) {
        console.debug(`Unable to watch "${file}" for changes: ${err}`);
      }
    }

    // If it's a published version, pull from cached file.
    else if (source === VersionSource.remote) {
      const file = this.getCacheFile(version);
      await this.ensureElectronVersionIsCachedAt(version, file);
      content = this.getTypesFromFile(file);
    }

    return content;
  }

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

  public uncache(ver: RunnableVersion) {
    if (ver.source === VersionSource.remote)
      fs.removeSync(this.getCacheFile(ver.version));
  }

  private async getTypesFromDir(dir: string): Promise<NodeTypes> {
    const types: NodeTypes = {};

    try {
      const files = (await readdir(dir, { recursive: true })).filter((f) =>
        f.endsWith('.d.ts'),
      );

      for (const file of files) {
        types[path.relative(dir, file) as keyof NodeTypes] = await fs.readFile(
          path.join(dir, file),
          'utf8',
        );
      }
    } catch (err) {
      console.debug(`Unable to read types from "${dir}": ${err.message}`);
    }

    return types;
  }

  private getTypesFromFile(file: string): string | undefined {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (err) {
      console.debug(`Unable to read types from "${file}": ${err.message}`);
      return undefined;
    }
  }

  private getCacheFile(version: string) {
    return path.join(this.electronCacheDir, version, ELECTRON_DTS);
  }

  private getCacheDir(version: string) {
    return path.join(this.nodeCacheDir, version);
  }

  public unwatch(window: BrowserWindow) {
    const localPath = this.localPaths.get(window);

    if (localPath) {
      this.localPaths.delete(window);

      const windows = this.getWindowsForLocalPath(localPath);

      // If it's the last window watching that path, close the watcher
      if (!windows.length) {
        const watcher = this.watchers.get(localPath);
        if (watcher) {
          watcher.close();
        }
        this.watchers.delete(localPath);
      }
    }
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

  private async ensureElectronVersionIsCachedAt(version: string, file: string) {
    if (fs.existsSync(file)) return;

    const name = version.includes('nightly') ? 'electron-nightly' : 'electron';
    const url = `https://unpkg.com/${name}@${version}/${ELECTRON_DTS}`;
    try {
      const response = await fetch(url);
      const text = await response.text();
      if (text.includes('Cannot find package')) throw new Error(text);
      fs.outputFileSync(file, text);
    } catch (err) {
      console.warn(`Error saving "${url}" to "${file}": ${err}`);
    }
  }
}

export async function setupTypes(knownVersions: ElectronVersions) {
  const userDataPath = app.getPath('userData');

  electronTypes = new ElectronTypes(
    knownVersions,
    path.join(userDataPath, 'electron-typedef'),
    path.join(userDataPath, 'nodejs-typedef'),
  );

  ipcMainManager.handle(
    IpcEvents.GET_ELECTRON_TYPES,
    (event: IpcMainEvent, ver: RunnableVersion) => {
      return electronTypes.getElectronTypes(
        BrowserWindow.fromWebContents(event.sender)!,
        ver,
      );
    },
  );
  ipcMainManager.handle(
    IpcEvents.GET_NODE_TYPES,
    (_: IpcMainEvent, version: string) => {
      return electronTypes.getNodeTypes(version);
    },
  );
  ipcMainManager.handle(
    IpcEvents.UNCACHE_TYPES,
    (_: IpcMainEvent, ver: RunnableVersion) => {
      electronTypes.uncache(ver);
    },
  );
  ipcMainManager.handle(
    IpcEvents.UNWATCH_ELECTRON_TYPES,
    (event: IpcMainEvent) => {
      electronTypes.unwatch(BrowserWindow.fromWebContents(event.sender)!);
    },
  );
}
