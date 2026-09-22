import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  Installer,
  InstallState,
  type InstallerOptions,
  type InstallStateEvent,
  type Mirrors,
  writeAtomic,
} from '@electron/fiddle-core';
import { app } from 'electron';
import { z } from 'zod';

import { suggestLocalBuildName } from '../../fiddle/versions';
import snapshotText from '../../../static/releases.json?raw';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { isHttpsUrl, MIRRORS, type Settings } from '../../shared/settings';
import type {
  LocalBuild,
  ReleaseRow,
  VersionRefValue,
  VersionsState,
} from '../../shared/stores';
import { fetchDownloader } from '../cli/downloader';
import { confirm, messageBox, pickFolder, type DialogParent } from '../dialogs';
import { tm } from '../i18n';
import { log } from '../log';
import { netFetch } from '../net-fetch';
import { createJsonStore, type JsonStore } from '../persistence/json-store';
import type { StateHub } from '../state-hub';
import type { CachePaths } from './paths';
import { isReleaseList, toReleaseRows } from './releases';
import { getEndpoints } from '../test-mode';

const PROGRESS_INTERVAL_MS = 100;
/** How long a local build's `available` is reused while progress publishes. */
const BUILD_CHECK_MS = 2000;
/** A cached release list this young is used without asking the network. */
const RELEASES_TTL_MS = 4 * 60 * 60 * 1000;
const RELEASES_TIMEOUT_MS = 30_000;

const storedBuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  addedAt: z.string(),
});
export type StoredBuild = z.infer<typeof storedBuildSchema>;
const localBuildsFileSchema = z.object({ builds: z.array(storedBuildSchema) });
type LocalBuildsFile = z.infer<typeof localBuildsFileSchema>;

/** core's installer on the shared cache. It takes cross-process locks. */
export function createInstaller(
  cache: CachePaths,
  options: Pick<InstallerOptions, 'downloader'> = {},
): Installer {
  return new Installer(
    { electronDownloads: cache.downloads, electronVersions: cache.electron },
    options,
  );
}

type FetchList = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

interface ReleaseList {
  text: string;
  rows: ReleaseRow[];
}

/** The rows of a releases.json text, for this platform; undefined if it isn't one. */
function parseReleases(text: string): ReleaseList | undefined {
  const data: unknown = JSON.parse(text);
  if (!isReleaseList(data)) return undefined;
  const { platform, arch } = process;
  const numStableBranches = process.env.NUM_STABLE_BRANCHES;
  return { text, rows: toReleaseRows(data, { platform, arch, numStableBranches }) };
}

/** ISO dates sort as text. */
const newestDate = (rows: readonly ReleaseRow[]) =>
  rows.reduce((newest, row) => (row.date > newest ? row.date : newest), '');

/**
 * The cached release list, or the bundled snapshot when there is none or the
 * app shipped a newer one. `fresh`: the cache is young enough to skip a fetch.
 */
export async function readReleaseList(
  cache: CachePaths,
): Promise<ReleaseList & { fresh: boolean }> {
  const snapshot = parseReleases(snapshotText)!;
  try {
    const cached = parseReleases(await fsp.readFile(cache.releases, 'utf8'));
    if (cached && newestDate(cached.rows) >= newestDate(snapshot.rows)) {
      const age = Date.now() - (await fsp.stat(cache.releases)).mtimeMs;
      return { ...cached, fresh: age >= 0 && age < RELEASES_TTL_MS };
    }
  } catch {
    // No usable cached list.
  }
  return { ...snapshot, fresh: false };
}

/** Fetches releases.json and caches its text. Throws when the fetch fails; a failed write is only logged. */
export async function fetchReleaseList(
  cache: CachePaths,
  url: string,
  fetch: FetchList,
): Promise<ReleaseList> {
  const response = await fetch(url, { signal: AbortSignal.timeout(RELEASES_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const list = parseReleases(await response.text());
  if (!list) throw new Error('Unexpected release list');
  await writeAtomic(cache.releases, list.text).catch((error: unknown) =>
    log.warn('caching the release list failed', error),
  );
  return list;
}

/** `@electron/get` appends the version folder to a mirror as is, so it needs its trailing slash. */
const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

/**
 * `auto` picks China's mirror for a zh-CN locale. A mirror the user chose
 * overrides `ELECTRON_MIRROR` and the like; `auto` and `default` leave those in charge.
 */
export function mirrorsFor(
  settings: Pick<Settings, 'mirror' | 'customMirrorElectron' | 'customMirrorNightly'>,
  systemLocale: string,
): Mirrors {
  const auto = settings.mirror === 'auto';
  const kind = auto
    ? systemLocale.toLowerCase() === 'zh-cn'
      ? 'china'
      : 'default'
    : settings.mirror;
  // The default mirror comes from the injected endpoints, so test mode uses the fixture server.
  const { electronMirror, electronNightlyMirror } = getEndpoints();
  if (kind === 'custom') {
    // Only https, since the binaries run. This also covers a hand-edited settings.json.
    const custom = (url: string) => (isHttpsUrl(url) ? withSlash(url) : undefined);
    const release = custom(settings.customMirrorElectron);
    const nightly = custom(settings.customMirrorNightly);
    return {
      electronMirror: release ?? electronMirror,
      electronNightlyMirror: nightly ?? electronNightlyMirror,
      ...(release || nightly ? { override: true } : {}),
    };
  }
  if (kind === 'china') {
    return {
      electronMirror: MIRRORS.china.electron,
      electronNightlyMirror: MIRRORS.china.nightly,
      ...(auto ? {} : { override: true }),
    };
  }
  return { electronMirror, electronNightlyMirror };
}

/** Downloads and unpacks a release, then drops its zip: the folder is all a run needs. Resolves with its executable. */
export async function installRelease(
  installer: Installer,
  cache: CachePaths,
  version: string,
  options: {
    mirror: Mirrors;
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  },
): Promise<string> {
  const { onProgress, signal } = options;
  try {
    const exec = await installer.install(version, {
      mirror: options.mirror,
      progressCallback: ({ percent }) => onProgress?.(percent),
      ...(signal ? { signal } : {}),
    });
    const zip = `electron-v${version}-${process.platform}-${process.arch}.zip`;
    await fsp.rm(path.join(cache.downloads, zip), { force: true }).catch(() => {});
    return exec;
  } catch (error) {
    if (signal?.aborted) throw error;
    // The installer's errors aren't FiddleErrors, so say what failed rather than "internal".
    log.warn(`downloading ${version} failed`, error);
    const message = FiddleError.from(error).message;
    throw new FiddleError(
      ErrorCode.network,
      tm('mainVersions')('downloadFailed', { version, message }),
    );
  }
}

export function installedExecPath(
  installer: Installer,
  cache: CachePaths,
  version: string,
): string | undefined {
  const exec = Installer.getExecPath(path.join(cache.electron, version));
  return installer.state(version) === InstallState.installed && fs.existsSync(exec)
    ? exec
    : undefined;
}

interface VersionsServiceOptions {
  hub: StateHub;
  cache: CachePaths;
  userData: string;
  releasesUrl: string;
  fetch: FetchList;
  /** Versions in use by some window; they can't be removed. */
  activeVersions: () => { releases: Set<string>; builds: Set<string> };
  /** Called after a version is removed, to drop its cached types. */
  onRemoved?: (version: string) => void;
}

export class VersionsService {
  readonly installer: Installer;
  readonly #options: VersionsServiceOptions;
  readonly #builds: JsonStore<LocalBuildsFile>;
  #rows: ReleaseRow[] = [];
  #releasesRev = 0;
  /** The text `#rows` came from, so a refresh that changes nothing rebuilds nothing. */
  #releasesText: string | undefined;
  #installs: VersionsState['installs'] = {};
  #downloadAll: AbortController | undefined;
  #downloadAllFailed = false;
  #progressTimer: ReturnType<typeof setTimeout> | undefined;
  #buildChecks = new Map<string, { at: number; available: boolean }>();

  constructor(options: VersionsServiceOptions) {
    this.#options = options;
    this.installer = createInstaller(options.cache, {
      downloader: fetchDownloader(netFetch),
    });
    this.installer.on('state-changed', (event: InstallStateEvent) =>
      this.#onState(event),
    );
    this.#builds = createJsonStore<LocalBuildsFile>({
      file: path.join(options.userData, 'local-builds.json'),
      schema: localBuildsFileSchema,
      defaults: { builds: [] },
      version: 1,
    });
  }

  /** Refreshes in the background unless the cached list is fresh. */
  async init(): Promise<void> {
    const { fresh, ...list } = await readReleaseList(this.#options.cache);
    this.#setReleases(list);
    if (fresh) return;
    this.refresh().catch((error: unknown) =>
      log.warn('refreshing the release list failed', error),
    );
  }

  releases(): ReleaseRow[] {
    return this.#rows;
  }

  release(version: string): ReleaseRow | undefined {
    return this.#rows.find((row) => row.version === version);
  }

  /** Fetches releases.json and caches it. Throws when the fetch fails. */
  async refresh(): Promise<void> {
    const { cache, releasesUrl, fetch } = this.#options;
    // Cached also when unchanged: the file's age is what tells `init` the list is fresh.
    const list = await fetchReleaseList(cache, releasesUrl, fetch).catch(
      (error: unknown) => {
        throw new FiddleError(ErrorCode.network, tm('mainVersions')('refreshFailed'), {
          cause: error instanceof Error ? error.message : String(error),
        });
      },
    );
    if (list.text !== this.#releasesText) this.#setReleases(list);
  }

  execPath(version: string): string | undefined {
    return installedExecPath(this.installer, this.#options.cache, version);
  }

  /** Resolves with the executable. A version the release list lacks is `notFound`. */
  async install(version: string, signal?: AbortSignal): Promise<string> {
    if (!this.release(version))
      throw new FiddleError(
        ErrorCode.notFound,
        tm('mainVersions')('versionUnknown', { version }),
      );
    return installRelease(this.installer, this.#options.cache, version, {
      mirror: this.#mirrors(),
      onProgress: (fraction) => this.#progress(version, fraction),
      ...(signal ? { signal } : {}),
    });
  }

  async remove(version: string): Promise<void> {
    if (this.#options.activeVersions().releases.has(version)) {
      throw new FiddleError(
        ErrorCode.conflict,
        tm('mainRun')('cannotRemoveActive', { version }),
      );
    }
    await this.#removeInstalled(version);
  }

  async downloadAll(versions: readonly string[]): Promise<void> {
    if (this.#downloadAll) return;
    const controller = new AbortController();
    this.#downloadAll = controller;
    this.#downloadAllFailed = false;
    this.#publish();
    try {
      for (const version of versions) {
        if (controller.signal.aborted) break;
        if (!this.release(version)?.supported || this.isInstalled(version)) continue;
        try {
          await this.install(version, controller.signal);
        } catch {
          if (controller.signal.aborted) break;
          this.#downloadAllFailed = true;
        }
      }
    } finally {
      this.#downloadAll = undefined;
      this.#publish();
    }
  }

  stopDownloadAll(): void {
    this.#downloadAll?.abort();
  }

  async deleteAll(): Promise<void> {
    const active = this.#options.activeVersions();
    this.stopDownloadAll();
    for (const [version, { state }] of Object.entries(this.#installs)) {
      if (
        active.releases.has(version) ||
        state === 'downloading' ||
        state === 'installing'
      )
        continue;
      await this.#removeInstalled(version).catch((error: unknown) =>
        log.warn(`removing ${version} failed`, error),
      );
    }
    this.#builds.set((prev) => ({
      builds: prev.builds.filter((b) => active.builds.has(b.id)),
    }));
    this.#publish();
  }

  /** `maxAgeMs`: reuse a disk check this recent, so a slow drive can't stall hot paths. */
  localBuilds(maxAgeMs = 0): LocalBuild[] {
    const now = Date.now();
    const checked = new Map<string, { at: number; available: boolean }>();
    const builds = this.#builds.get().builds.map((b) => {
      let check = this.#buildChecks.get(b.path);
      if (!check || now - check.at >= maxAgeMs) {
        check = { at: now, available: fs.existsSync(Installer.getExecPath(b.path)) };
      }
      checked.set(b.path, check);
      return { id: b.id, name: b.name, path: b.path, available: check.available };
    });
    this.#buildChecks = checked;
    return builds;
  }

  localBuild(id: string): LocalBuild | undefined {
    return this.localBuilds().find((b) => b.id === id);
  }

  /** What a window's version is called: the release number, or the local build's name. */
  label(ref: VersionRefValue): string {
    return ref.kind === 'release'
      ? ref.version
      : (this.localBuild(ref.id)?.name ?? ref.id);
  }

  isInstalled(version: string): boolean {
    return this.installer.state(version) === InstallState.installed;
  }

  /** A folder that's already registered asks "Switch to <name>?" and returns its ID if the user agrees. */
  async addLocalBuild(parent: DialogParent): Promise<string | undefined> {
    const t = tm('mainRun');
    const folder = await pickFolder(parent, {
      title: t('addLocalBuildTitle'),
      buttonLabel: t('addLocalBuildButton'),
    });
    if (!folder) return undefined;
    const existing = this.#builds
      .get()
      .builds.find((b) => path.resolve(b.path) === path.resolve(folder));
    if (existing) {
      const tv = tm('mainVersions');
      const ok = await confirm(parent, {
        message: tv('switchToBuild', { name: existing.name }),
        detail: tv('switchToBuildDetail'),
        ok: tv('switchButton'),
      });
      return ok ? existing.id : undefined;
    }
    if (!fs.existsSync(Installer.getExecPath(folder))) {
      await messageBox(parent, {
        type: 'error',
        message: t('noBinaryTitle'),
        detail: t('noBinaryDetail', { file: Installer.execSubpath(), path: folder }),
      });
      return undefined;
    }
    return this.registerLocalBuild(folder);
  }

  registerLocalBuild(folder: string): string {
    const resolved = path.resolve(folder);
    const existing = this.#builds
      .get()
      .builds.find((b) => path.resolve(b.path) === resolved);
    if (existing) return existing.id;
    const build: StoredBuild = {
      id: randomUUID(),
      name: suggestLocalBuildName(resolved),
      path: resolved,
      addedAt: new Date().toISOString(),
    };
    this.#builds.set((prev) => ({ builds: [...prev.builds, build] }));
    this.#publish();
    return build.id;
  }

  removeLocalBuild(id: string): void {
    if (this.#options.activeVersions().builds.has(id)) {
      const name = this.localBuild(id)?.name ?? id;
      throw new FiddleError(
        ErrorCode.conflict,
        tm('mainRun')('cannotRemoveActive', { version: name }),
      );
    }
    this.#builds.set((prev) => ({ builds: prev.builds.filter((b) => b.id !== id) }));
    this.#publish();
  }

  /** Removes a version and drops its cached types. Throws if it's still there, for example a file was in use. */
  async #removeInstalled(version: string): Promise<void> {
    await this.installer.remove(version);
    if (this.installer.state(version) !== InstallState.missing) {
      throw new FiddleError(
        ErrorCode.unavailable,
        tm('mainVersions')('removeFailed', { version }),
      );
    }
    this.#options.onRemoved?.(version);
  }

  #setReleases({ rows, text }: ReleaseList): void {
    this.#rows = rows;
    this.#releasesText = text;
    for (const { version } of this.#rows) {
      const state = this.installer.state(version);
      if (state !== InstallState.missing) this.#installs[version] ??= { state };
    }
    this.#releasesRev += 1;
    this.#publish();
  }

  #mirrors(): Mirrors {
    return mirrorsFor(this.#options.hub.app.settings, app.getSystemLocale());
  }

  #onState({ version, state }: InstallStateEvent): void {
    if (state === InstallState.missing) delete this.#installs[version];
    else this.#installs[version] = { state };
    this.#publish();
  }

  #progress(version: string, fraction: number): void {
    const percent = Math.min(100, Math.round(fraction * 100));
    const known = this.#installs[version];
    if (known?.state === 'downloading' && known.percent === percent) return;
    this.#installs[version] = { state: 'downloading', percent };
    this.#progressTimer ??= setTimeout(() => this.#publish(), PROGRESS_INTERVAL_MS);
  }

  #publish(): void {
    if (this.#progressTimer) clearTimeout(this.#progressTimer);
    this.#progressTimer = undefined;
    this.#options.hub.updateApp({
      versions: {
        releasesRev: this.#releasesRev,
        installs: { ...this.#installs },
        localBuilds: this.localBuilds(BUILD_CHECK_MS),
        downloadingAll: this.#downloadAll !== undefined,
        downloadAllFailed: this.#downloadAllFailed,
        arch: process.arch,
      },
    });
  }
}
