import * as path from 'path';

import * as fs from 'fs-extra';
import * as MonacoType from 'monaco-editor';
import watch from 'node-watch';
import packageJson from 'package-json';
import readdir from 'recursive-readdir';
import semver from 'semver';

import releases from '../../static/releases.json';
import { RunnableVersion, Version, VersionSource } from '../interfaces';
import { normalizeVersion } from '../utils/normalize-version';

const ELECTRON_DTS = 'electron.d.ts';

/**
 * Keeps monaco informed of the current Electron version's .d.ts
 *
 * - provide the current version's .d.ts to Monaco for intellisense
 * - if it's a local version, refresh whenever the .d.ts file changes
 * - if it's a remote version, fetch() the .d.ts and cache it locally
 */
export class ElectronTypes {
  private disposables: MonacoType.IDisposable[] = [];
  private watcher: fs.FSWatcher | undefined;

  constructor(
    private readonly monaco: typeof MonacoType,
    private readonly electronCacheDir: string,
    private readonly nodeCacheDir: string,
  ) {}

  public async setVersion(ver?: RunnableVersion): Promise<void> {
    this.clear();

    if (!ver) return;

    await this.setElectronTypes(ver);
    await this.setNodeTypes(ver.version);
  }

  private async setElectronTypes(ver: RunnableVersion): Promise<void> {
    const { localPath: dir, source, version } = ver;

    // If it's a local development version, pull Electron types from out directory.
    if (dir) {
      const file = path.join(dir, 'gen/electron/tsc/typings', ELECTRON_DTS);
      this.setTypesFromFile(file, version);
      try {
        this.watcher = watch(file, () => this.setTypesFromFile(file, version));
      } catch (err) {
        console.debug(`Unable to watch "${file}" for changes: ${err}`);
      }
    }

    // If it's a published version, pull from cached file.
    if (source === VersionSource.remote) {
      const file = this.getCacheFile(version);
      await this.ensureElectronVersionIsCachedAt(version, file);
      this.setTypesFromFile(file, version);
    }
  }

  private async setNodeTypes(version: string): Promise<void> {
    // Get the Node.js version corresponding to the current Electron version.
    const v = releases.find((release: Version) => {
      return normalizeVersion(release.version) === version;
    })?.node;

    if (!v) return;

    const dir = this.getCacheDir(v);
    const ver = await this.cacheAndReturnNodeTypesVersion(v, dir);
    await this.setTypesFromDir(dir, ver);
  }

  public uncache(ver: RunnableVersion) {
    if (ver.source === VersionSource.remote)
      fs.removeSync(this.getCacheFile(ver.version));
  }

  private async setTypesFromDir(dir: string, version: string) {
    this.dispose();
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (file.endsWith('.d.ts')) {
          const { base: filename } = path.parse(file);
          console.log(`Updating Monaco with "${filename}@${version}"`);
          const lib = this.monaco.languages.typescript.javascriptDefaults.addExtraLib(
            fs.readFileSync(file, 'utf8'),
          );
          this.disposables.push(lib);
        }
      }
    } catch (err) {
      console.debug(`Unable to read types from "${dir}": ${err.message}`);
    }
  }

  private setTypesFromFile(file: string, version: string) {
    this.dispose();
    try {
      console.log(`Updating Monaco with "${ELECTRON_DTS}@${version}"`);
      const lib = this.monaco.languages.typescript.javascriptDefaults.addExtraLib(
        fs.readFileSync(file, 'utf8'),
      );
      this.disposables.push(lib);
    } catch (err) {
      console.debug(`Unable to read types from "${file}": ${err.message}`);
    }
  }

  private getCacheFile(version: string) {
    return path.join(this.electronCacheDir, version, ELECTRON_DTS);
  }

  private getCacheDir(version: string) {
    return path.join(this.nodeCacheDir, version);
  }

  private clear() {
    this.dispose();
    this.unwatch();
  }

  private dispose() {
    if (this.disposables.length > 0) {
      for (const disposable of this.disposables) {
        disposable.dispose();
      }
      this.disposables = [];
    }
  }

  private unwatch() {
    if (this.watcher) {
      this.watcher.close();
      delete this.watcher;
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

    const { files: fileJson } = await response.json();
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
        await fs.outputFileSync(`${dir}${path}`, text);
      });

    return downloadVersion;
  }

  private async ensureElectronVersionIsCachedAt(version: string, file: string) {
    if (fs.existsSync(file)) return;

    const name = version.includes('nightly') ? 'electron-nightly' : 'electron';
    const url = `https://unpkg.com/${name}@${version}/${ELECTRON_DTS}`;
    try {
      const response = await window.fetch(url);
      const text = await response.text();
      if (text.includes('Cannot find package')) throw new Error(text);
      fs.outputFileSync(file, text);
    } catch (err) {
      console.warn(`Error saving "${url}" to "${file}": ${err}`);
    }
  }
}
