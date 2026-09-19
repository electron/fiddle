/**
 * Editor types: `electron.d.ts` and `@types/node` from unpkg, cached under
 * `<cache>/types`, or a local build's own `electron.d.ts`, which is watched.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import type { EditorTypes, LocalBuild } from '../../shared/stores';
import { log } from '../log';
import { writeAtomic } from '../persistence/json-store';
import { getEndpoints } from '../test-mode';

const FETCH_CONCURRENCY = 8;

interface TypesServiceOptions {
  /** `<cache>/types`. */
  dir: string;
  fetch: (url: string) => Promise<Response>;
  /** The Node version bundled with an Electron release. */
  nodeVersionOf: (version: string) => string | undefined;
  /** A watched local build's types changed. */
  onLocalChange: (buildId: string) => void;
}

interface MetaEntry {
  path?: unknown;
  type?: unknown;
  files?: unknown;
}

/** unpkg `?meta`, flat (`files: [{ path }]`) or nested (`type: 'directory'`), → `.d.ts` paths. */
function typeFilesFromMeta(meta: unknown): string[] {
  const out: string[] = [];
  const walk = (entry: MetaEntry) => {
    if (Array.isArray(entry.files))
      for (const child of entry.files as MetaEntry[]) walk(child);
    else if (typeof entry.path === 'string' && entry.path.endsWith('.d.ts'))
      out.push(entry.path);
  };
  if (typeof meta === 'object' && meta !== null) walk(meta as MetaEntry);
  // Skip typesVersions copies for older TypeScript (`/ts5.6/…`).
  return out.filter((p) => !/^\/ts\d/.test(p)).sort();
}

export class TypesService {
  readonly #options: TypesServiceOptions;
  readonly #inflight = new Map<string, Promise<unknown>>();
  /** Local build ID → closes its watcher. */
  readonly #watchers = new Map<string, () => void>();

  constructor(options: TypesServiceOptions) {
    this.#options = options;
  }

  async forRelease(version: string): Promise<EditorTypes> {
    const nodeVersion = this.#options.nodeVersionOf(version);
    const [electron, node] = await Promise.all([
      this.#once(`electron:${version}`, () => this.#electron(version)),
      nodeVersion
        ? this.#once(`node:${nodeVersion}`, () => this.#node(nodeVersion))
        : Promise.resolve({}),
    ]);
    return { version, electron, node };
  }

  async forLocal(build: LocalBuild): Promise<EditorTypes> {
    const file = path.join(
      build.path,
      'gen',
      'electron',
      'tsc',
      'typings',
      'electron.d.ts',
    );
    this.#watch(build.id, file);
    const electron = await fsp.readFile(file, 'utf8').catch(() => null);
    return { version: build.name, electron, node: {} };
  }

  /** Stops watching every local build whose ID isn't in `ids`. */
  retainWatches(ids: ReadonlySet<string>): void {
    for (const buildId of [...this.#watchers.keys()])
      if (!ids.has(buildId)) this.#unwatch(buildId);
  }

  /** Drops a removed version's cached `electron.d.ts`. */
  async removeVersion(version: string): Promise<void> {
    await fsp.rm(path.join(this.#options.dir, 'electron', `${version}.d.ts`), {
      force: true,
    });
  }

  #once<T>(key: string, load: () => Promise<T>): Promise<T> {
    let promise = this.#inflight.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = load().finally(() => this.#inflight.delete(key));
      this.#inflight.set(key, promise);
    }
    return promise;
  }

  async #electron(version: string): Promise<string | null> {
    const file = path.join(this.#options.dir, 'electron', `${version}.d.ts`);
    const cached = await fsp.readFile(file, 'utf8').catch(() => undefined);
    if (cached !== undefined) return cached;
    const pkg = version.includes('nightly') ? 'electron-nightly' : 'electron';
    const text = await this.#text(
      `${getEndpoints().unpkg}/${pkg}@${version}/electron.d.ts`,
    );
    if (text !== undefined) await writeCache(file, text);
    return text ?? null;
  }

  async #node(nodeVersion: string): Promise<Record<string, string>> {
    const file = path.join(this.#options.dir, 'node', `${nodeVersion}.json`);
    try {
      return JSON.parse(await fsp.readFile(file, 'utf8')) as Record<string, string>;
    } catch {
      // not cached yet
    }
    const major = nodeVersion.split('.')[0] ?? nodeVersion;
    let spec = nodeVersion;
    let meta = await this.#json(`${getEndpoints().unpkg}/@types/node@${spec}/?meta`);
    if (meta === undefined) {
      spec = major;
      meta = await this.#json(`${getEndpoints().unpkg}/@types/node@${spec}/?meta`);
    }
    if (meta === undefined) return {};
    const resolved = (meta as { version?: unknown }).version;
    if (typeof resolved === 'string') spec = resolved;

    const paths = typeFilesFromMeta(meta);
    const files: Record<string, string> = {};
    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const p = paths[next++]!;
        const text = await this.#text(`${getEndpoints().unpkg}/@types/node@${spec}${p}`);
        if (text !== undefined) files[p.slice(1)] = text;
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(FETCH_CONCURRENCY, paths.length) }, worker),
    );
    // A set with files missing is used this time but not cached, so a later launch fetches it again.
    if (paths.length > 0 && Object.keys(files).length === paths.length)
      await writeCache(file, JSON.stringify(files));
    return files;
  }

  async #text(url: string): Promise<string | undefined> {
    try {
      const response = await this.#options.fetch(url);
      return response.ok ? await response.text() : undefined;
    } catch (error) {
      log.warn('fetching types failed', url, error);
      return undefined;
    }
  }

  async #json(url: string): Promise<unknown> {
    const text = await this.#text(url);
    if (text === undefined) return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  }

  #unwatch(buildId: string): void {
    this.#watchers.get(buildId)?.();
    this.#watchers.delete(buildId);
  }

  #watch(buildId: string, file: string): void {
    if (this.#watchers.has(buildId) || !fs.existsSync(file)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let replaced = false;
    try {
      const watcher = fs.watch(file, (event) => {
        replaced ||= event === 'rename';
        clearTimeout(timer);
        timer = setTimeout(() => {
          // A rebuild that replaces the file leaves the watcher on the old one.
          if (replaced) {
            this.#unwatch(buildId);
            this.#watch(buildId, file);
          }
          this.#options.onLocalChange(buildId);
        }, 300);
      });
      watcher.on('error', () => this.#unwatch(buildId));
      this.#watchers.set(buildId, () => {
        clearTimeout(timer);
        watcher.close();
      });
    } catch (error) {
      log.warn('watching local build types failed', file, error);
    }
  }
}

async function writeCache(file: string, text: string): Promise<void> {
  try {
    await writeAtomic(file, text);
  } catch (error) {
    log.warn('caching types failed', file, error);
  }
}
