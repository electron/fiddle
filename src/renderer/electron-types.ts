import * as MonacoType from 'monaco-editor';
import * as fs from 'fs-extra';
import * as path from 'path';
import releases from 'electron-releases/lite.json';
import readdir from 'recursive-readdir';

import { RunnableVersion, VersionSource } from '../interfaces';
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
  private disposable: MonacoType.IDisposable | undefined;
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

  public async setElectronTypes(ver: RunnableVersion): Promise<void> {
    const { localPath: dir, source, version } = ver;

    // If it's a local development version, pull Electron types from out directory.
    if (dir) {
      const file = path.join(dir, 'gen/electron/tsc/typings', ELECTRON_DTS);
      this.setTypesFromFile(file, ver.version);
      try {
        this.watcher = fs.watch(file, () =>
          this.setTypesFromFile(file, ver.version),
        );
      } catch (err) {
        console.debug(`Unable to watch "${file}" for changes: ${err}`);
      }
    }

    // If it's a published version, pull from cached file.
    if (source === VersionSource.remote) {
      const file = this.getCacheFile(ver.version);
      await ElectronTypes.ensureElectronVersionIsCachedAt(version, file);
      this.setTypesFromFile(file, ver.version);
    }
  }

  public async setNodeTypes(version: string): Promise<void> {
    // Get the Node.js version corresponding to the current Electron version.
    const v = releases.find((release: any) => {
      return normalizeVersion(release.tag_name) === version;
    })?.deps?.node;

    if (!v) return;

    const dir = this.getCacheDir(v);
    await ElectronTypes.ensureNodeVersionIsCachedAt(v, dir);
    await this.setTypesFromDir(dir, v);
  }

  public uncache(ver: RunnableVersion) {
    if (ver.source === VersionSource.remote)
      fs.removeSync(this.getCacheFile(ver.version));
  }

  private async setTypesFromDir(dir: string, version: string) {
    console.log('setTypesFromDir');
    this.dispose();

    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (file.endsWith('.d.ts')) {
          const { base: filename } = path.parse(file);
          console.log(`Updating Monaco with "${filename}@${version}"`);
          this.disposable = this.monaco.languages.typescript.javascriptDefaults.addExtraLib(
            fs.readFileSync(file, 'utf8'),
          );
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
      this.disposable = this.monaco.languages.typescript.javascriptDefaults.addExtraLib(
        fs.readFileSync(file, 'utf8'),
      );
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
    if (this.disposable) {
      this.disposable.dispose();
      delete this.disposable;
    }
  }

  private unwatch() {
    if (this.watcher) {
      this.watcher.close();
      delete this.watcher;
    }
  }

  private static async ensureNodeVersionIsCachedAt(
    version: string,
    dir: string,
  ) {
    if (fs.existsSync(dir)) return;

    const fileResponse = await fetch(
      `https://unpkg.com/@types/node@${version}/?meta`,
    );
    const { files: fileJson } = await fileResponse.json();
    fileJson
      .flatMap((item: { files?: { path: string }[]; path: string }) => {
        return item.files ? item.files.map((f: any) => f.path) : item.path;
      })
      .filter((path: string) => path.endsWith('.d.ts'))
      .map(async (path: string) => {
        const res = await fetch(
          `https://unpkg.com/@types/node@${version}${path}`,
        );
        const text = await res.text();
        await fs.outputFileSync(`${dir}${path}`, text);
      });
  }

  private static async ensureElectronVersionIsCachedAt(
    version: string,
    file: string,
  ) {
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
