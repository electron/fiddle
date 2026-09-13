/**
 * Electron versions (REQUIREMENTS §17.8, §5 "Cache"):
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
  type InstallStateEvent,
  type Mirrors,
} from '@electron/fiddle-core';
import { app, dialog, type BrowserWindow } from 'electron';
import { z } from 'zod';

import { suggestLocalBuildName } from '../../fiddle/versions';
import snapshotText from '../../../static/releases.json?raw';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { MIRRORS } from '../../shared/settings';
import type { LocalBuild, ReleaseRow, VersionsState } from '../../shared/stores';
import { tm } from '../i18n';
import { log } from '../log';
import { createJsonStore, type JsonStore } from '../persistence/json-store';
import type { StateHub } from '../state-hub';
import type { CachePaths } from './paths';
import { isReleaseList, toReleaseRows } from './releases';

export const RELEASES_URL = 'https://releases.electronjs.org/releases.json';
const PROGRESS_INTERVAL_MS = 100;

const storedBuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  addedAt: z.string(),
});
type StoredBuild = z.infer<typeof storedBuildSchema>;
const localBuildsFileSchema = z.object({ builds: z.array(storedBuildSchema) });
interface LocalBuildsFile {
  builds: StoredBuild[];
}

export interface VersionsServiceOptions {
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
  #installs: VersionsState['installs'] = {};
  #downloadAll: AbortController | undefined;
  #progressTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: VersionsServiceOptions) {
    this.#options = options;
    const { cache } = options;
    this.installer = new Installer(
      {
        electronDownloads: cache.downloads,
        electronInstall: path.join(cache.root, 'current'),
        electronVersions: cache.electron,
        versionsCache: cache.releases,
      },
      // `per-version` always takes cross-process locks.
      { layout: 'per-version', errors: 'typed' },
    );
    this.installer.on('state-changed', (event: InstallStateEvent) => this.#onState(event));
    this.#builds = createJsonStore<LocalBuildsFile>({
      file: path.join(options.userData, 'local-builds.json'),
      schema: localBuildsFileSchema,
      defaults: { builds: [] },
      version: 1,
    });
  }

  /** Loads the cached or bundled list, publishes the store, then refreshes in the background. */
  async init(): Promise<void> {
    const cached = await this.#readCache();
    await this.#setReleases(cached ?? (JSON.parse(snapshotText) as unknown[]));
    void this.refresh();
  }

  get electronVersions(): ElectronVersions {
    if (!this.#versions) throw new FiddleError(ErrorCode.unavailable, 'The release list is not loaded yet');
    return this.#versions;
  }

  releases(): ReleaseRow[] {
    return this.#rows;
  }

  release(version: string): ReleaseRow | undefined {
    return this.#rows.find((row) => row.version === version);
  }

  /** Fetches releases.json with Chromium's network stack and caches it. Failures are logged. */
  async refresh(): Promise<void> {
    try {
      const response = await this.#options.fetch(this.#options.releasesUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isReleaseList(data)) throw new Error('Unexpected release list');
      const file = this.#options.cache.releases;
      await fsp.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(data));
      await fsp.rename(tmp, file);
      await this.#setReleases(data);
    } catch (error) {
      log.warn('refreshing the release list failed', error);
    }
  }

  state(version: string): InstallState {
    return this.installer.state(version);
  }

  /** The executable of an installed release. */
  execPath(version: string): string | undefined {
    const exec = Installer.getExecPath(path.join(this.#options.cache.electron, version));
    return this.state(version) === InstallState.installed && fs.existsSync(exec) ? exec : undefined;
  }

  /** Downloads and unpacks a release. Resolves with its executable. */
  async install(version: string, signal?: AbortSignal): Promise<string> {
    const exec = await this.installer.install(version, {
      mirror: this.#mirrors(),
      progressCallback: ({ percent }) => this.#progress(version, percent),
      ...(signal ? { signal } : {}),
    });
    // The unpacked folder is all a run needs; drop the zip.
    const zip = `electron-v${version}-${process.platform}-${process.arch}.zip`;
    await fsp.rm(path.join(this.#options.cache.downloads, zip), { force: true }).catch(() => {});
    return exec;
  }

  async remove(version: string): Promise<void> {
    if (this.#options.activeVersions().releases.has(version)) {
      throw new FiddleError(ErrorCode.conflict, tm('mainRun')('cannotRemoveActive', { version }));
    }
    await this.installer.remove(version);
    this.#options.onRemoved?.(version);
  }

  async downloadAll(versions: readonly string[]): Promise<void> {
    if (this.#downloadAll) return;
    const controller = new AbortController();
    this.#downloadAll = controller;
    this.#publish();
    try {
      for (const version of versions) {
        if (controller.signal.aborted) break;
        if (!this.release(version)?.supported || this.state(version) === InstallState.installed) continue;
        try {
          await this.install(version, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) break;
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
      if (active.releases.has(version) || state === 'downloading' || state === 'installing') continue;
      await this.installer.remove(version).catch((error: unknown) => log.warn(`removing ${version} failed`, error));
      this.#options.onRemoved?.(version);
    }
    this.#builds.set((prev) => ({ builds: prev.builds.filter((b) => active.builds.has(b.id)) }));
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

  /** Asks for a build folder. Returns the build's ID (an existing one if already registered). */
  async addLocalBuild(win: BrowserWindow | undefined): Promise<string | undefined> {
    const t = tm('mainRun');
    const options = {
      title: t('addLocalBuildTitle'),
      buttonLabel: t('addLocalBuildButton'),
      properties: ['openDirectory' as const],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    const folder = result.filePaths[0];
    if (result.canceled || !folder) return undefined;
    if (!fs.existsSync(Installer.getExecPath(folder))) {
      const box = {
        type: 'error' as const,
        message: t('noBinaryTitle'),
        detail: t('noBinaryDetail', { file: Installer.execSubpath(), path: folder }),
      };
      if (win) await dialog.showMessageBox(win, box);
      else await dialog.showMessageBox(box);
      return undefined;
    }
    return this.registerLocalBuild(folder);
  }

  /** Registers a folder that holds an Electron build. A folder that's already registered keeps its ID. */
  registerLocalBuild(folder: string): string {
    const resolved = path.resolve(folder);
    const existing = this.#builds.get().builds.find((b) => path.resolve(b.path) === resolved);
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
      throw new FiddleError(ErrorCode.conflict, tm('mainRun')('cannotRemoveActive', { version: name }));
    }
    this.#builds.set((prev) => ({ builds: prev.builds.filter((b) => b.id !== id) }));
    this.#publish();
  }

  async #readCache(): Promise<unknown[] | undefined> {
    try {
      const data: unknown = JSON.parse(await fsp.readFile(this.#options.cache.releases, 'utf8'));
      return isReleaseList(data) ? data : undefined;
    } catch {
      return undefined;
    }
  }

  async #setReleases(data: unknown[]): Promise<void> {
    const versions = await ElectronVersions.create({
      initialVersions: data,
      ignoreCache: true,
      paths: { versionsCache: this.#options.cache.releases },
      releasesUrl: this.#options.releasesUrl,
    });
    this.#versions = versions;
    this.#rows = isReleaseList(data)
      ? toReleaseRows(data, {
          stableMajors: versions.stableMajors,
          supportedMajors: versions.supportedMajors,
          platform: process.platform,
          arch: process.arch,
          numStableBranches: process.env.NUM_STABLE_BRANCHES,
        })
      : [];
    for (const { version } of this.#rows) {
      const state = this.installer.state(version);
      if (state !== InstallState.missing) this.#installs[version] ??= { state };
    }
    this.#releasesRev += 1;
    this.#publish();
  }

  #mirrors(): Mirrors {
    const settings = this.#options.hub.app.settings;
    const kind =
      settings.mirror === 'auto'
        ? app.getSystemLocale().toLowerCase() === 'zh-cn'
          ? 'china'
          : 'default'
        : settings.mirror;
    if (kind === 'custom') {
      return {
        electronMirror: settings.customMirrorElectron || MIRRORS.default.electron,
        electronNightlyMirror: settings.customMirrorNightly || MIRRORS.default.nightly,
      };
    }
    return { electronMirror: MIRRORS[kind].electron, electronNightlyMirror: MIRRORS[kind].nightly };
  }

  #onState({ version, state }: InstallStateEvent): void {
    if (state === InstallState.missing) delete this.#installs[version];
    else this.#installs[version] = { state };
    this.#publish();
  }

  #progress(version: string, fraction: number): void {
    this.#installs[version] = { state: 'downloading', percent: Math.min(100, Math.round(fraction * 100)) };
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
        arch: process.arch,
      },
    });
  }
}
