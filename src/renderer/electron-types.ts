import * as MonacoType from 'monaco-editor';

import { ELECTRON_DTS } from '../constants';
import { NodeTypes, RunnableVersion, VersionSource } from '../interfaces';

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

  constructor(private readonly monaco: typeof MonacoType) {
    window.ElectronFiddle.addEventListener(
      'electron-types-changed',
      (types, version) => {
        // Dispose of any previous Electron types so there's only ever one
        this.electronTypesDisposable?.dispose();
        this.electronTypesDisposable = undefined;

        this.setElectronTypes(types, version);
      },
    );
  }

  public async setVersion(ver?: RunnableVersion): Promise<void> {
    this.clear();

    if (!ver) return;

    this.setElectronTypes(
      // Destructure ver so it's not a Proxy object, which can't be used
      await window.ElectronFiddle.getElectronTypes({ ...ver }),
      ver.version,
    );
    await this.setNodeTypes(ver.version);
  }

  private setElectronTypes(types: string | undefined, version: string): void {
    if (types) {
      console.log(`Updating Monaco with "${ELECTRON_DTS}@${version}"`);
      this.electronTypesDisposable =
        this.monaco.languages.typescript.javascriptDefaults.addExtraLib(types);
    } else {
      console.log(`No types found for "${ELECTRON_DTS}@${version}"`);
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
      console.log(`No Node.js types found for Electron ${ver}`);
    }
  }

  public async uncache(ver: RunnableVersion) {
    if (ver.source === VersionSource.remote) {
      // Destructure ver so it's not a Proxy object, which can't be used
      await window.ElectronFiddle.uncacheTypes({ ...ver });
    }
  }

  private async clear() {
    this.dispose();
    await window.ElectronFiddle.unwatchElectronTypes();
  }

  private dispose() {
    this.electronTypesDisposable?.dispose();
    this.electronTypesDisposable = undefined;

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
