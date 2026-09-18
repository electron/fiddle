/**
 * Electron versions:
 *
 * - The release list starts from the bundled snapshot or the cached copy, and
 *   is refreshed with `net.fetch` at startup and on demand. Only `releasesRev`
 *   is stored; the list is fetched with `Versions.GetReleases`.
 * - Installs use core's `Installer` in the `per-version` layout with locks:
 *   `<cache>/electron/<version>/`. Install state and progress go in
 *   `App.versions`, at most 10 updates a second.
 * - Local builds live in `<userData>/local-builds.json`.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  ElectronVersions,
  Installer,
  InstallState,
  type InstallerOptions,
  type InstallStateEvent,
  type Mirrors,
} from '@electron/fiddle-core';
import { app, net } from 'electron';
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
import { createJsonStore, writeAtomic, type JsonStore } from '../persistence/json-store';
import type { StateHub } from '../state-hub';
import type { CachePaths } from './paths';
import { isReleaseList, toReleaseRows } from './releases';
import { getEndpoints } from '../test-mode';

const PROGRESS_INTERVAL_MS = 100;

/** `fetch` on Chromium's network stack, so the system proxy and certificates apply. */
const netFetch: typeof fetch = (input, init) =>
  net.fetch(input instanceof URL ? input.href : input, init as RequestInit);

const storedBuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  addedAt: z.string(),
});
type StoredBuild = z.infer<typeof storedBuildSchema>;
const localBuildsFileSchema = z.object({ builds: z.array(storedBuildSchema) });
type LocalBuildsFile = z.infer<typeof localBuildsFileSchema>;

/**
 * core's installer on the shared cache, in the `per-version` layout, which
 * always takes cross-process locks. `options.downloader` is a `net.fetch` one.
 */
export function createInstaller(
  cache: CachePaths,
  options: Pick<InstallerOptions, 'downloader'> = {},
): Installer {
  return new Installer(
    {
      electronDownloads: cache.downloads,
      electronInstall: path.join(cache.root, 'current'),
      electronVersions: cache.electron,
      versionsCache: cache.releases,
    },
    { layout: 'per-version', errors: 'typed', ...options },
  );
}

interface ReleaseListText {
  text: string;
  data: unknown[];
}

/** The cached release list, or else the bundled snapshot, with its text. */
async function readReleaseListText(cache: CachePaths): Promise<ReleaseListText> {
  try {
    const text = await fsp.readFile(cache.releases, 'utf8');
    const data: unknown = JSON.parse(text);
    if (isReleaseList(data)) return { text, data };
  } catch {
    // No cached list yet.
  }
  return { text: snapshotText, data: JSON.parse(snapshotText) as unknown[] };
}

async function fetchReleaseListText(
  url: string,
  fetch: (url: string) => Promise<Response>,
): Promise<ReleaseListText> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const data: unknown = JSON.parse(text);
  if (!isReleaseList(data)) throw new Error('Unexpected release list');
  return { text, data };
}

/** Caches the list. A failed write is only logged: the fetched list is still good. */
function cacheReleaseList(cache: CachePaths, text: string): Promise<void> {
  return writeAtomic(cache.releases, text).catch((error: unknown) =>
    log.warn('caching the release list failed', error),
  );
}

/** The cached release list, or else the bundled snapshot. */
export async function readReleaseList(cache: CachePaths): Promise<unknown[]> {
  return (await readReleaseListText(cache)).data;
}

/** Fetches releases.json and caches it. Throws on failure. */
export async function fetchReleaseList(
  cache: CachePaths,
  url: string,
  fetch: (url: string) => Promise<Response>,
): Promise<unknown[]> {
  const { text, data } = await fetchReleaseListText(url, fetch);
  await cacheReleaseList(cache, text);
  return data;
}

/** core's `ElectronVersions` and the release rows for a release list. */
export async function loadReleases(
  data: unknown[],
  cache: CachePaths,
  url: string,
): Promise<{ versions: ElectronVersions; rows: ReleaseRow[] }> {
  const versions = await ElectronVersions.create({
    initialVersions: data,
    ignoreCache: true,
    paths: { versionsCache: cache.releases },
    releasesUrl: url,
  });
  const rows = isReleaseList(data)
    ? toReleaseRows(data, {
        stableMajors: versions.stableMajors,
        supportedMajors: versions.supportedMajors,
        platform: process.platform,
        arch: process.arch,
        numStableBranches: process.env.NUM_STABLE_BRANCHES,
      })
    : [];
  return { versions, rows };
}

/** `@electron/get` appends the version folder to a mirror as is, so it needs its trailing slash. */
const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

/**
 * Download mirrors for the mirror settings. `auto` picks China's for a zh-CN
 * system locale. A mirror the user chose (China, or a custom one) overrides
 * `ELECTRON_MIRROR` and the like; `auto` and `default` leave those in charge.
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
    // A mirror serves the binaries every run executes, so only https. The
    // schema refuses others too; this also covers a hand-edited settings.json.
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
  const exec = await installer.install(version, {
    mirror: options.mirror,
    progressCallback: ({ percent }) => onProgress?.(percent),
    ...(signal ? { signal } : {}),
  });
  const zip = `electron-v${version}-${process.platform}-${process.arch}.zip`;
  await fsp.rm(path.join(cache.downloads, zip), { force: true }).catch(() => {});
  return exec;
}

/** The executable of an installed release, or undefined if it isn't installed. */
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
  fetch: (url: string) => Promise<Response>;
  /** Versions in use by some window; they can't be removed. */
  activeVersions: () => { releases: Set<string>; builds: Set<string> };
  /** Called after a version is removed, to drop its cached types. */
  onRemoved?: (version: string) => void;
}

export class VersionsService {
  readonly installer: Installer;
  readonly #options: VersionsServiceOptions;
  readonly #builds: JsonStore<LocalBuildsFile>;
  #versions: ElectronVersions | undefined;
  #rows: ReleaseRow[] = [];
  #releasesRev = 0;
  /** The text of the list `#rows` came from, to skip a refresh that changes nothing. */
  #releasesText: string | undefined;
  #installs: VersionsState['installs'] = {};
  #downloadAll: AbortController | undefined;
  #downloadAllFailed = false;
  #progressTimer: ReturnType<typeof setTimeout> | undefined;

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

  /** Loads the cached or bundled list, publishes the store, then refreshes in the background. */
  async init(): Promise<void> {
    const { text, data } = await readReleaseListText(this.#options.cache);
    await this.#setReleases(data, text);
    this.refresh().catch((error: unknown) =>
      log.warn('refreshing the release list failed', error),
    );
  }

  get electronVersions(): ElectronVersions {
    if (!this.#versions)
      throw new FiddleError(ErrorCode.unavailable, 'The release list is not loaded yet');
    return this.#versions;
  }

  releases(): ReleaseRow[] {
    return this.#rows;
  }

  release(version: string): ReleaseRow | undefined {
    return this.#rows.find((row) => row.version === version);
  }

  /** Fetches releases.json with Chromium's network stack and caches it. Throws when the fetch fails. */
  async refresh(): Promise<void> {
    const { cache, releasesUrl, fetch } = this.#options;
    const { text, data } = await fetchReleaseListText(releasesUrl, fetch).catch(
      (error: unknown) => {
        throw new FiddleError(ErrorCode.network, tm('mainVersions')('refreshFailed'), {
          cause: error instanceof Error ? error.message : String(error),
        });
      },
    );
    if (text === this.#releasesText) return;
    await this.#setReleases(data, text);
    await cacheReleaseList(cache, text);
  }

  state(version: string): InstallState {
    return this.installer.state(version);
  }

  /** The executable of an installed release. */
  execPath(version: string): string | undefined {
    return installedExecPath(this.installer, this.#options.cache, version);
  }

  /** Downloads and unpacks a release. Resolves with its executable. */
  async install(version: string, signal?: AbortSignal): Promise<string> {
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
        if (
          !this.release(version)?.supported ||
          this.state(version) === InstallState.installed
        )
          continue;
        try {
          await this.install(version, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) break;
          this.#downloadAllFailed = true;
          log.warn(`downloading ${version} failed`, error);
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

  /** Removes every download and local build that no window uses. */
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

  localBuilds(): LocalBuild[] {
    return this.#builds.get().builds.map((b) => ({
      id: b.id,
      name: b.name,
      path: b.path,
      available: fs.existsSync(Installer.getExecPath(b.path)),
    }));
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

  /**
   * Asks for a build folder. Returns the build's ID. A folder that's already
   * registered asks "Switch to <name>?" and returns its ID if the user agrees.
   */
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

  /** Registers a folder that holds an Electron build. A folder that's already registered keeps its ID. */
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

  async #setReleases(data: unknown[], text: string): Promise<void> {
    const { versions, rows } = await loadReleases(
      data,
      this.#options.cache,
      this.#options.releasesUrl,
    );
    this.#versions = versions;
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
        localBuilds: this.localBuilds(),
        downloadingAll: this.#downloadAll !== undefined,
        downloadAllFailed: this.#downloadAllFailed,
        arch: process.arch,
      },
    });
  }
}
