import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import * as asar from '@electron/asar';
import debug from 'debug';

import { FiddleCoreError } from './errors.js';
import { copyFolder, remove } from './fs-util.js';
import { DefaultPaths } from './paths.js';

function hashString(str: string): string {
  const md5sum = createHash('md5');
  md5sum.update(str);
  return md5sum.digest('hex');
}

function git(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (err) => (err ? reject(err) : resolve()));
  });
}

export class Fiddle {
  constructor(
    public readonly mainPath: string, // /path/to/main.js
    public readonly source: string,
  ) {}

  public remove(): Promise<void> {
    return remove(path.dirname(this.mainPath));
  }
}

/**
 * - Iterable of [string, string] - filename-to-content key/value pairs
 * - string of form '/path/to/fiddle' - a fiddle on the filesystem
 * - string of form 'https://github.com/my/repo.git' - a git repo fiddle
 * - string of form '642fa8daaebea6044c9079e3f8a46390' - a github gist fiddle
 */
export type FiddleSource = Fiddle | string | Iterable<[string, string]>;

export interface FiddleFactoryCreateOptions {
  packAsAsar?: boolean;
}

export class FiddleFactory {
  constructor(private readonly fiddles: string = DefaultPaths.fiddles) {}

  public async fromGist(gistId: string): Promise<Fiddle> {
    return this.fromRepo(`https://gist.github.com/${gistId}.git`);
  }

  public async fromFolder(source: string): Promise<Fiddle> {
    const d = debug('fiddle-core:FiddleFactory:fromFolder');

    const folder = path.join(this.fiddles, hashString(source));
    d({ source, folder });
    await remove(folder);

    // asar files are copied as files, in case any deps bundle Electron, for
    // example @electron/remote
    await copyFolder(source, folder);

    return new Fiddle(path.join(folder, 'main.js'), source);
  }

  /** `checkout` is a branch. Default: the repository's default branch. */
  public async fromRepo(url: string, checkout?: string): Promise<Fiddle> {
    const d = debug('fiddle-core:FiddleFactory:fromRepo');
    const folder = path.join(this.fiddles, hashString(url));
    d({ url, checkout, folder });

    if (!fs.existsSync(folder)) {
      d(`cloning "${url}" into "${folder}"`);
      await git(['clone', '--depth=1', '--', url, folder]);
    }

    if (checkout) {
      await git(['checkout', checkout], folder);
      await git(['pull', 'origin', checkout], folder);
    } else {
      await git(['pull', '--ff-only'], folder);
    }

    return new Fiddle(path.join(folder, 'main.js'), url);
  }

  public async fromEntries(src: Iterable<[string, string]>): Promise<Fiddle> {
    const d = debug('fiddle-core:FiddleFactory:fromEntries');
    const map = new Map<string, string>(src);

    const md5sum = createHash('md5');
    for (const content of map.values()) md5sum.update(content);
    const hash = md5sum.digest('hex');
    const folder = path.resolve(this.fiddles, hash);
    await fs.promises.mkdir(folder, { recursive: true });
    d({ folder });

    await Promise.all(
      [...map.entries()].map(([filename, content]) => {
        const filePath = path.resolve(folder, filename);
        const relative = path.relative(folder, filePath);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
          throw new FiddleCoreError(
            'invalid-fiddle',
            `Refusing to write file outside of fiddle: "${filename}"`,
          );
        }
        return fs.promises.writeFile(filePath, content, 'utf8');
      }),
    );

    return new Fiddle(path.join(folder, 'main.js'), 'entries');
  }

  public async create(
    src: FiddleSource,
    options?: FiddleFactoryCreateOptions,
  ): Promise<Fiddle | undefined> {
    let fiddle: Fiddle;
    if (src instanceof Fiddle) {
      fiddle = src;
    } else if (typeof src === 'string') {
      if (fs.existsSync(src)) {
        fiddle = await this.fromFolder(src);
      } else if (/^[0-9A-Fa-f]{32}$/.test(src)) {
        fiddle = await this.fromGist(src);
      } else if (src.startsWith('https:') || src.endsWith('.git')) {
        fiddle = await this.fromRepo(src);
      } else {
        return;
      }
    } else {
      fiddle = await this.fromEntries(src);
    }

    if (options?.packAsAsar) {
      // a folder the caller passed in as a `Fiddle` stays theirs
      fiddle = await this.packageFiddleAsAsar(fiddle, !(src instanceof Fiddle));
    }
    return fiddle;
  }

  /** Packs the fiddle's folder into an asar. With `owned`, the folder is then deleted. */
  private async packageFiddleAsAsar(fiddle: Fiddle, owned: boolean): Promise<Fiddle> {
    const sourceDir = path.dirname(fiddle.mainPath);
    const asarOutputDir = path.join(this.fiddles, hashString(sourceDir));
    const asarFilePath = path.join(asarOutputDir, 'app.asar');

    await asar.createPackage(sourceDir, asarFilePath);
    if (owned) await remove(sourceDir);
    return new Fiddle(asarFilePath, fiddle.source);
  }
}
