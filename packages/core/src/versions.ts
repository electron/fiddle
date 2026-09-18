import fs from 'node:fs';
import path from 'node:path';

import debug from 'debug';
import { parse as semverParse, SemVer } from 'semver';

import {
  type ErrorMode,
  FiddleCoreError,
  isFiddleCoreError,
  wrapError,
} from './errors.js';
import { writeFileAtomic } from './fs-util.js';
import { DefaultPaths, type Paths } from './paths.js';

export { SemVer };

export type SemOrStr = SemVer | string;

export interface ReleaseInfo {
  /** Electron version */
  version: string;
  /** Release date */
  date: string;
  /** Node.js version */
  node: string;
  /** V8 version */
  v8: string;
  /** uv version */
  uv: string;
  /** zlib version */
  zlib: string;
  /** OpenSSL version */
  openssl: string;
  /** Node.js modules version */
  modules: string;
  /** Chromium version */
  chrome: string;
  /** Files included in the release */
  files: Array<string>;
}

/**
 * Interface for an object that manages a list of Electron releases.
 *
 * See {@link BaseVersions} for testing situations.
 * See {@link ElectronVersions} for production.
 */
export interface Versions {
  /** Semver-Major numbers of branches that only have prereleases */
  readonly prereleaseMajors: number[];

  /** Semver-Major numbers of branches that have supported stable releases */
  readonly supportedMajors: number[];

  /** Semver-Major numbers of branches that are no longer supported */
  readonly obsoleteMajors: number[];

  /** The latest release (by version, not by date) */
  readonly latest: SemVer | undefined;

  /** The latest stable (by version, not by date) */
  readonly latestStable: SemVer | undefined;

  /** Full list of all known Electron releases, Sorted in branch order. */
  readonly versions: SemVer[];

  /** @returns true iff `version` is a release that this object knows about */
  isVersion(version: SemOrStr): boolean;

  /** @returns all versions matching that major number. Sorted in branch order. */
  inMajor(major: number): SemVer[];

  /**
   * @returns all versions in a range, inclusive. Sorted in branch order.
   * @throws an `invalid-version` {@link FiddleCoreError} if `a` or `b` is not a release that this object knows about
   */
  inRange(a: SemOrStr, b: SemOrStr): SemVer[];

  /** @returns {@link ReleaseInfo} iff `version` is a release that this object knows about */
  getReleaseInfo(version: SemOrStr): ReleaseInfo | undefined;
}

export interface ElectronVersionsCreateOptions {
  /** Initial versions to use if there is no cache. When provided, no initial fetch is done */
  initialVersions?: unknown;

  /** Ignore the cache even if it exists and is fresh */
  ignoreCache?: boolean;

  /** Paths to use for the cache and fiddles */
  paths?: Partial<Paths>;

  /** Where to fetch the releases list. Default: https://releases.electronjs.org/releases.json */
  releasesUrl?: string;

  /** With `typed`, a failed fetch is wrapped in a `download-failed` error. Default: `legacy`. */
  errors?: ErrorMode;
}

const DEFAULT_RELEASES_URL = 'https://releases.electronjs.org/releases.json';

export function compareVersions(a: SemVer, b: SemVer): number {
  const l = a.compareMain(b);
  if (l) return l;
  // Electron's approach is nightly -> other prerelease tags -> stable,
  // so force `nightly` to sort before other prerelease tags.
  const [prea] = a.prerelease;
  const [preb] = b.prerelease;
  if (prea === 'nightly' && preb !== 'nightly') return -1;
  if (prea !== 'nightly' && preb === 'nightly') return 1;
  return a.comparePre(b);
}

function hasVersion(val: unknown): val is { version: unknown } {
  return typeof val === 'object' && val !== null && 'version' in val;
}

function isReleaseInfo(val: unknown): val is ReleaseInfo {
  return (
    typeof val === 'object' &&
    val !== null &&
    'version' in val &&
    typeof val.version === 'string' &&
    'date' in val &&
    typeof val.date === 'string' &&
    'node' in val &&
    typeof val.node === 'string' &&
    'v8' in val &&
    typeof val.v8 === 'string' &&
    'uv' in val &&
    typeof val.uv === 'string' &&
    'zlib' in val &&
    typeof val.zlib === 'string' &&
    'openssl' in val &&
    typeof val.openssl === 'string' &&
    'modules' in val &&
    typeof val.modules === 'string' &&
    'chrome' in val &&
    typeof val.chrome === 'string' &&
    'files' in val &&
    isArrayOfStrings(val.files)
  );
}

function isArrayOfVersionObjects(val: unknown): val is Array<{ version: string }> {
  return (
    Array.isArray(val) &&
    val.every((item) => hasVersion(item) && typeof item.version === 'string')
  );
}

function isArrayOfStrings(val: unknown): val is Array<string> {
  return Array.isArray(val) && val.every((item) => typeof item === 'string');
}

/**
 * Drops the 0.2x series. Pre-0.24.0 releases were 'atom-shell' and cannot be
 * downloaded with @electron/get, and everything before 0.30.0 (Aug 2015) is
 * unsupported.
 */
function isSupportedVersion({ version }: { version: string }): boolean {
  return !version.startsWith('0.2');
}

const NUM_SUPPORTED_MAJORS = 3;

/**
 * Implementation of {@link Versions} that does everything except self-populate.
 * It needs to be fed version info in its constructor.
 *
 * In production, use subclass '{@link ElectronVersions}'. This base class is
 * useful in testing because it's an easy way to inject fake test data into a
 * real Versions object.
 */
export class BaseVersions implements Versions {
  private readonly map = new Map<string, SemVer>();
  private readonly releaseInfo = new Map<string, ReleaseInfo>();

  protected setVersions(val: unknown): void {
    this.releaseInfo.clear();

    let parsed: Array<SemVer | null> = [];
    if (isArrayOfVersionObjects(val)) {
      parsed = val.filter(isSupportedVersion).map(({ version }) => semverParse(version));

      for (const entry of val) {
        if (isReleaseInfo(entry) && isSupportedVersion(entry)) {
          this.releaseInfo.set(entry.version, {
            version: entry.version,
            date: entry.date,
            node: entry.node,
            v8: entry.v8,
            uv: entry.uv,
            zlib: entry.zlib,
            openssl: entry.openssl,
            modules: entry.modules,
            chrome: entry.chrome,
            files: [...entry.files],
          });
        }
      }
    } else if (isArrayOfStrings(val)) {
      parsed = val
        .filter((version) => isSupportedVersion({ version }))
        .map((version) => semverParse(version));
    } else {
      console.warn('Unrecognized versions:', val);
    }

    const semvers = parsed.filter((sem): sem is SemVer => Boolean(sem));
    semvers.sort((a, b) => compareVersions(a, b));
    this.map.clear();
    for (const sem of semvers) this.map.set(sem.version, sem);
  }

  public constructor(versions: unknown) {
    this.setVersions(versions);
  }

  public get prereleaseMajors(): number[] {
    const majors = new Set<number>();
    for (const ver of this.map.values()) {
      majors.add(ver.major);
    }
    for (const ver of this.map.values()) {
      if (ver.prerelease.length === 0) {
        majors.delete(ver.major);
      }
    }
    return [...majors];
  }

  public get stableMajors(): number[] {
    const majors = new Set<number>();
    for (const ver of this.map.values()) {
      if (ver.prerelease.length === 0) {
        majors.add(ver.major);
      }
    }
    return [...majors];
  }

  public get supportedMajors(): number[] {
    return this.stableMajors.slice(-NUM_SUPPORTED_MAJORS);
  }

  public get obsoleteMajors(): number[] {
    return this.stableMajors.slice(0, -NUM_SUPPORTED_MAJORS);
  }

  public get versions(): SemVer[] {
    return [...this.map.values()];
  }

  public get latest(): SemVer | undefined {
    return this.versions.pop();
  }

  public get latestStable(): SemVer | undefined {
    let stable: SemVer | undefined = undefined;
    for (const ver of this.map.values()) {
      if (ver.prerelease.length === 0) {
        stable = ver;
      }
    }
    return stable;
  }

  public isVersion(ver: SemOrStr): boolean {
    return this.map.has(typeof ver === 'string' ? ver : ver.version);
  }

  public inMajor(major: number): SemVer[] {
    const versions: SemVer[] = [];
    for (const ver of this.map.values()) {
      if (ver.major === major) {
        versions.push(ver);
      }
    }
    return versions;
  }

  public inRange(a: SemOrStr, b: SemOrStr): SemVer[] {
    const versions = [...this.map.values()];
    const indexOf = (ver: SemOrStr) => {
      const normal = semverParse(ver)?.version;
      const index = versions.findIndex((known) => known.version === normal);
      if (index === -1) {
        throw new FiddleCoreError(
          'invalid-version',
          `Unknown Electron version: "${ver.toString()}"`,
        );
      }
      return index;
    };
    let first = indexOf(a);
    let last = indexOf(b);
    if (first > last) [first, last] = [last, first];
    return versions.slice(first, last + 1);
  }

  public getReleaseInfo(ver: SemOrStr): ReleaseInfo | undefined {
    return this.releaseInfo.get(typeof ver === 'string' ? ver : ver.version);
  }
}

/**
 * Implementation of Versions that self-populates from release information at
 * https://releases.electronjs.org/releases.json .
 *
 * This is generally what to use in production.
 */
export class ElectronVersions extends BaseVersions {
  private constructor(
    private readonly versionsCache: string,
    private mtimeMs: number,
    values: unknown,
    private readonly releasesUrl: string = DEFAULT_RELEASES_URL,
  ) {
    super(values);
  }

  private static async fetchVersions(
    cacheFile: string,
    url: string,
    errors?: ErrorMode,
  ): Promise<unknown> {
    const d = debug('fiddle-core:ElectronVersions:fetchVersions');
    d('fetching releases list from', url);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new FiddleCoreError(
          'download-failed',
          `Fetching versions failed with status code: ${response.status}`,
        );
      }
      const json: unknown = await response.json();
      if (!Array.isArray(json)) {
        throw new FiddleCoreError('download-failed', 'The releases list is not an array');
      }
      await fs.promises.mkdir(path.dirname(cacheFile), { recursive: true });
      await writeFileAtomic(cacheFile, JSON.stringify(json));
      return json;
    } catch (err) {
      throw isFiddleCoreError(err) ? err : wrapError(errors, 'download-failed', err);
    }
  }

  private static isCacheFresh(cacheTimeMs: number, now: number): boolean {
    const VERSION_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
    return now <= cacheTimeMs + VERSION_CACHE_TTL_MS;
  }

  public static async create(
    options: ElectronVersionsCreateOptions = {},
  ): Promise<ElectronVersions> {
    const d = debug('fiddle-core:ElectronVersions:create');
    const { versionsCache } = { ...DefaultPaths, ...options?.paths };
    const releasesUrl = options.releasesUrl ?? DEFAULT_RELEASES_URL;

    // Use initialVersions instead if provided, and don't fetch if so
    let versions = options.initialVersions;
    let staleCache = false;
    // when the list was last fetched; a stale cache that can't be refreshed keeps its age
    let mtimeMs = Date.now();

    if (!options.ignoreCache) {
      try {
        const st = await fs.promises.stat(versionsCache);
        versions = JSON.parse(await fs.promises.readFile(versionsCache, 'utf8'));
        mtimeMs = st.mtimeMs;
        staleCache = !ElectronVersions.isCacheFresh(mtimeMs, Date.now());
      } catch (err) {
        d('cache file missing or cannot be read', err);
      }
    }

    if (!versions || staleCache) {
      try {
        versions = await ElectronVersions.fetchVersions(
          versionsCache,
          releasesUrl,
          options.errors,
        );
        mtimeMs = Date.now();
      } catch (err) {
        d('error fetching versions', err);
        if (!versions) {
          throw err;
        }
      }
    }

    return new ElectronVersions(versionsCache, mtimeMs, versions, releasesUrl);
  }

  /** Refetches the releases list. A failed fetch is ignored and the current list kept. */
  public async fetch(): Promise<void> {
    const d = debug('fiddle-core:ElectronVersions:fetch');
    const { mtimeMs, versionsCache } = this;
    try {
      this.mtimeMs = Date.now();
      const versions = await ElectronVersions.fetchVersions(
        versionsCache,
        this.releasesUrl,
      );
      this.setVersions(versions);
      d(`saved "${versionsCache}"`);
    } catch (err) {
      d('error fetching versions', err);
      this.mtimeMs = mtimeMs;
    }
  }

  private async keepFresh(): Promise<void> {
    if (!ElectronVersions.isCacheFresh(this.mtimeMs, Date.now())) {
      await this.fetch();
    }
  }

  public override get prereleaseMajors(): number[] {
    void this.keepFresh();
    return super.prereleaseMajors;
  }
  public override get stableMajors(): number[] {
    void this.keepFresh();
    return super.stableMajors;
  }
  public override get supportedMajors(): number[] {
    void this.keepFresh();
    return super.supportedMajors;
  }
  public override get obsoleteMajors(): number[] {
    void this.keepFresh();
    return super.obsoleteMajors;
  }
  public override get versions(): SemVer[] {
    void this.keepFresh();
    return super.versions;
  }
  public override get latest(): SemVer | undefined {
    void this.keepFresh();
    return super.latest;
  }
  public override get latestStable(): SemVer | undefined {
    void this.keepFresh();
    return super.latestStable;
  }
  public override isVersion(ver: SemOrStr): boolean {
    void this.keepFresh();
    return super.isVersion(ver);
  }
  public override inMajor(major: number): SemVer[] {
    void this.keepFresh();
    return super.inMajor(major);
  }
  public override inRange(a: SemOrStr, b: SemOrStr): SemVer[] {
    void this.keepFresh();
    return super.inRange(a, b);
  }
}
