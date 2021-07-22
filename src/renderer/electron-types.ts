import * as MonacoType from 'monaco-editor';
import { RunnableVersion } from '../interfaces';

/**
 * Keeps monaco informed of the current Electron version's .d.ts
 *
 * - provide the current version's .d.ts to Monaco for intellisense
 * - if it's a local version, refresh whenever the .d.ts file changes
 * - if it's a remote version, fetch() the .d.ts and cache it locally
 */
export class ElectronTypes {
  constructor(
    private readonly monaco: typeof MonacoType,
    private readonly cacheDir: string,
  ) {
    console.log(Boolean(this.monaco), Boolean(this.cacheDir));
  }

  public async setVersion(ver?: RunnableVersion): Promise<void> {
    console.log(ver);
  }

  public uncache(ver: RunnableVersion) {
    console.log(ver);
  }
}
