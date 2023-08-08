import * as path from 'node:path';

import * as fs from 'fs-extra';
import * as MonacoType from 'monaco-editor';
import watch from 'node-watch';

import { NodeTypes, RunnableVersion, VersionSource } from '../interfaces';

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
  private electronTypesDisposable: MonacoType.IDisposable | undefined;
  private watcher: fs.FSWatcher | undefined;

  constructor(
    private readonly monaco: typeof MonacoType,
    private readonly electronCacheDir: string,
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

  private async setNodeTypes(ver: string): Promise<void> {
    const nodeTypes = await window.ElectronFiddle.getNodeTypes(ver);
    if (nodeTypes) {
      console.log(
        `Updating Monaco with files for Node.js ${nodeTypes.version}:`,
        Object.keys(nodeTypes.types),
      );

      for (const file of Object.keys(nodeTypes.types)) {
        const lib =
          this.monaco.languages.typescript.javascriptDefaults.addExtraLib(
            nodeTypes.types[file as keyof NodeTypes],
          );
        this.disposables.push(lib);
      }
    } else {
      console.log(`No types found for Node.js in Electron ${ver}`);
    }
  }

  public uncache(ver: RunnableVersion) {
    if (ver.source === VersionSource.remote)
      fs.removeSync(this.getCacheFile(ver.version));
  }

  private setTypesFromFile(file: string, version: string) {
    // Dispose of any previous Electron types so there's only ever one
    this.electronTypesDisposable?.dispose();
    this.electronTypesDisposable = undefined;

    try {
      console.log(`Updating Monaco with "${ELECTRON_DTS}@${version}"`);
      this.electronTypesDisposable =
        this.monaco.languages.typescript.javascriptDefaults.addExtraLib(
          fs.readFileSync(file, 'utf8'),
        );
    } catch (err) {
      console.debug(`Unable to read types from "${file}": ${err.message}`);
    }
  }

  private getCacheFile(version: string) {
    return path.join(this.electronCacheDir, version, ELECTRON_DTS);
  }

  private clear() {
    this.dispose();
    this.unwatch();
  }

  private dispose() {
    this.electronTypesDisposable?.dispose();
    this.electronTypesDisposable = undefined;

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
