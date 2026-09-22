import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';

import {
  download as electronDownload,
  ElectronDownloadCacheMode,
  type ElectronDownloadRequestOptions,
} from '@electron/get';
import debug from 'debug';
import semver from 'semver';

import { FiddleCoreError, abortError, throwIfAborted } from './errors.js';
import { extractZip } from './extract.js';
import {
  remove,
  removeBestEffort,
  rename,
  renameIntoPlace,
  safeHostname,
} from './fs-util.js';
import { LOCK_STALE_MS, isProcessAlive, withLock } from './lock.js';
import { warmExecutable } from './warm.js';

export interface Paths {
  // folder where electron zipfiles will be cached
  readonly electronDownloads: string;

  // folder holding one immutable folder per installed version
  readonly electronVersions: string;
}

function getZipName(version: string): string {
  return `electron-v${version}-${process.platform}-${process.arch}.zip`;
}

function assertValidVersion(version: string): void {
  if (semver.valid(version) !== version) {
    throw new FiddleCoreError(
      'invalid-version',
      `Invalid Electron version: "${version}"`,
    );
  }
}

// Temp and trash folders in `electronVersions` and `electronDownloads` are
// named `.tmp-<version>_<host>_<pid>_<random>` and `.rm-…`, so a sweep can
// tell whether their owner is gone. Neither a version nor a host contains `_`.
const LEFTOVER_RE = /^\.(?:tmp|rm)-.+_([A-Za-z0-9.-]+)_(\d+)_[A-Za-z0-9]+$/;
/** Past this age a leftover goes even if its pid is alive (reused) or its host unknown. */
const LEFTOVER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ProgressObject = { percent: number };

/**
 * The state of a current Electron version.
 * See {@link Installer.state} to get this value.
 * See Installer.on('state-changed') to watch for state changes.
 */
export enum InstallState {
  missing = 'missing',
  downloading = 'downloading',
  downloaded = 'downloaded',
  installing = 'installing',
  installed = 'installed',
}

export interface InstallStateEvent {
  version: string;
  state: InstallState;
}

export interface Mirrors {
  electronMirror: string;
  electronNightlyMirror: string;
  /**
   * Download from exactly these mirrors. `@electron/get` otherwise lets
   * `ELECTRON_MIRROR`, `ELECTRON_CUSTOM_DIR`, `ELECTRON_CUSTOM_FILENAME` and
   * the `npm_config_electron_*` variables take precedence over them.
   */
  override?: boolean;
}

/** What `@electron/get` passes to `resolveAssetURL`. */
interface AssetDetails {
  version: string;
  artifactName: string;
  isGeneric?: boolean;
  platform?: string;
  arch?: string;
  artifactSuffix?: string;
}

/** The URL `@electron/get` builds from a mirror, with no part of it read from the environment. */
function mirrorAssetUrl(mirror: Partial<Mirrors>, asset: AssetDetails): string {
  const base = asset.version.includes('nightly')
    ? mirror.electronNightlyMirror
    : mirror.electronMirror;
  if (!base) throw new Error(`No mirror is set for Electron ${asset.version}`);
  const file = asset.isGeneric
    ? asset.artifactName
    : `${[
        asset.artifactName,
        asset.version,
        asset.platform,
        asset.arch,
        ...(asset.artifactSuffix ? [asset.artifactSuffix] : []),
      ].join('-')}.zip`;
  return `${base}${asset.version}/${file}`;
}

export interface InstallerParams {
  progressCallback: (progress: ProgressObject) => void;
  mirror: Mirrors;
  /**
   * Stops waiting with an `aborted` {@link FiddleCoreError}. Concurrent calls
   * for one version share one download and install, which stops only once
   * every caller has aborted.
   */
  signal?: AbortSignal;
}

export interface InstallerOptions {
  /** Mirrors used when a call doesn't pass its own `mirror`. */
  mirror?: Partial<Mirrors>;
  /**
   * Downloads each file (`@electron/get`'s `downloader`). The default uses
   * Node's `fetch`; Electron apps can pass one backed by `net.fetch`, so the
   * system proxy and certificate store apply.
   */
  downloader?: ElectronDownloadRequestOptions['downloader'];
}

/** Work shared by concurrent callers. See {@link Installer.shared}. */
interface SharedTask<T> {
  promise: Promise<T>;
  controller: AbortController;
  /** Callers still waiting. The work aborts when this drops to zero. */
  waiting: number;
  progress: Set<(progress: ProgressObject) => void>;
}

/**
 * Manage downloading and installing Electron versions.
 *
 * An Electron release's .zip is downloaded into `paths.electronDownloads`,
 * which holds all the downloaded zips.
 *
 * Each version gets its own immutable folder in `paths.electronVersions`. It
 * is extracted to a temp folder and renamed into place, so it is either
 * complete or absent. Several versions can be installed at once, and downloads
 * and installs take cross-process locks, so several processes can share the
 * cache.
 */
export class Installer extends EventEmitter {
  private readonly options: Readonly<{
    mirror: Partial<Mirrors>;
    downloader: InstallerOptions['downloader'];
  }>;
  private readonly stateMap = new Map<string, InstallState>();
  /** Downloads and installs in flight, keyed `download:<version>` and `install:<version>`. */
  private readonly inflight = new Map<string, SharedTask<unknown>>();
  /** Windows warm-ups still running, by version: each holds its executable open. */
  private readonly warming = new Map<string, Promise<void>>();

  constructor(
    private readonly paths: Paths,
    options: InstallerOptions = {},
  ) {
    super();
    this.options = Object.freeze({
      mirror: { ...options.mirror },
      downloader: options.downloader,
    });
    this.rebuildStates();
  }

  public static execSubpath(platform: string = process.platform): string {
    switch (platform) {
      case 'darwin':
        return 'Electron.app/Contents/MacOS/Electron';
      case 'win32':
        return 'electron.exe';
      default:
        return 'electron';
    }
  }

  public static getExecPath(folder: string): string {
    return path.join(folder, Installer.execSubpath());
  }

  public state(version: string): InstallState {
    return this.stateMap.get(version) || InstallState.missing;
  }

  private setState(version: string, state: InstallState) {
    const d = debug('fiddle-core:Installer:setState');
    const oldState = this.state(version);

    if (state === InstallState.missing) {
      this.stateMap.delete(version);
    } else {
      this.stateMap.set(version, state);
    }

    const newState = this.state(version);
    d(inspect({ version, oldState, newState }));
    if (oldState !== newState) {
      const event: InstallStateEvent = { version, state: newState };
      d('emitting state-changed', inspect(event));
      this.emit('state-changed', event);
    }
  }

  private versionDir(version: string): string {
    return path.join(this.paths.electronVersions, version);
  }

  private installLockPath(version: string): string {
    return path.join(this.paths.electronVersions, '.locks', `${version}.lock`);
  }

  private rebuildStates() {
    const str = `^electron-v(.*)-${process.platform}-${process.arch}.zip$`;
    const reg = new RegExp(str);
    try {
      for (const file of fs.readdirSync(this.paths.electronDownloads)) {
        const match = reg.exec(file);
        if (match?.[1]) {
          this.setState(match[1], InstallState.downloaded);
        }
      }
    } catch {
      // no download directory yet
    }

    try {
      for (const name of fs.readdirSync(this.paths.electronVersions)) {
        const exec = Installer.getExecPath(this.versionDir(name));
        if (semver.valid(name) && fs.existsSync(exec)) {
          this.setState(name, InstallState.installed);
        }
      }
    } catch {
      // no versions directory yet
    }
  }

  /**
   * Removes an Electron download or Electron install from the disk. A failure
   * is logged, not thrown, and the state then says what is left.
   */
  public async remove(version: string): Promise<void> {
    const d = debug('fiddle-core:Installer:remove');
    d(version);
    assertValidVersion(version);
    const removed = (target: string) =>
      remove(target).then(
        () => true,
        (err: unknown) => {
          console.warn(`Installer: failed to remove ${target}`, err);
          return false;
        },
      );

    const zipPath = path.join(this.paths.electronDownloads, getZipName(version));
    const downloadRemoved = await removed(zipPath);

    if (await this.removeVersionDir(version)) {
      this.setState(
        version,
        downloadRemoved ? InstallState.missing : InstallState.downloaded,
      );
    }
  }

  /** Removes a per-version folder. It counts as removed once it is moved aside. */
  private async removeVersionDir(version: string): Promise<boolean> {
    const dir = this.versionDir(version);
    try {
      await this.warming.get(version);
      await withLock(this.installLockPath(version), {}, async () => {
        if (fs.existsSync(dir)) await this.trash(version);
      });
      return true;
    } catch (err) {
      console.warn(`Installer: failed to remove ${dir}`, err);
      return false;
    }
  }

  /** `<version>_<host>_<pid>_`, the start of a temp or trash folder's name. */
  private static leftoverTag(version: string): string {
    return `${version}_${safeHostname()}_${process.pid}_`;
  }

  /**
   * Moves a version's folder aside, then deletes it best-effort. If the delete
   * fails (say, a file is in use on Windows), a later sweep retries it.
   */
  private async trash(version: string): Promise<void> {
    const trash = path.join(
      this.paths.electronVersions,
      `.rm-${Installer.leftoverTag(version)}${randomBytes(4).toString('hex')}`,
    );
    await rename(this.versionDir(version), trash);
    await removeBestEffort(trash);
  }

  /**
   * Deletes temp and trash folders left in `dir` by a process that has died
   * (on this host; or a day old, in case its pid was reused) or that are older
   * than `otherHostAgeMs` (from other hosts).
   */
  private async sweep(dir: string, otherHostAgeMs: number): Promise<void> {
    const host = safeHostname();
    for (const name of await fs.promises.readdir(dir).catch(() => [])) {
      const match = LEFTOVER_RE.exec(name);
      if (!match) continue;
      const entry = path.join(dir, name);
      try {
        const age = Date.now() - (await fs.promises.stat(entry)).mtimeMs;
        const gone =
          match[1] === host
            ? !isProcessAlive(Number(match[2])) || age > LEFTOVER_MAX_AGE_MS
            : age > otherHostAgeMs;
        if (gone) await removeBestEffort(entry);
      } catch {
        // already deleted
      }
    }
  }

  /**
   * Runs `work` once for all concurrent callers with the same `key`. `work`
   * gets its own signal, which aborts only when every caller has aborted, and
   * its progress goes to every caller. Each caller stops waiting as soon as
   * its own signal aborts.
   */
  private async shared<T>(
    key: string,
    opts: Partial<InstallerParams> | undefined,
    work: (params: Partial<InstallerParams>) => Promise<T>,
  ): Promise<T> {
    const signal = opts?.signal;
    throwIfAborted(signal);

    let task = this.inflight.get(key) as SharedTask<T> | undefined;
    if (!task) {
      const controller = new AbortController();
      const progress = new Set<(progress: ProgressObject) => void>();
      const promise = work({
        mirror: opts?.mirror,
        signal: controller.signal,
        progressCallback: (p) => progress.forEach((cb) => cb(p)),
      });
      const created: SharedTask<T> = { promise, controller, waiting: 0, progress };
      const forget = () => {
        if (this.inflight.get(key) === created) this.inflight.delete(key);
      };
      promise.then(forget, forget);
      this.inflight.set(key, created as SharedTask<unknown>);
      task = created;
    }

    const joined = task;
    const onProgress = opts?.progressCallback;
    if (onProgress) joined.progress.add(onProgress);
    joined.waiting++;
    if (!signal) return joined.promise;

    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        if (onProgress) joined.progress.delete(onProgress);
        if (--joined.waiting === 0) {
          // Nobody is waiting any more. Stop the work, and let the next
          // caller start afresh rather than join work that is stopping.
          if (this.inflight.get(key) === joined) this.inflight.delete(key);
          joined.controller.abort(signal.reason);
        }
        reject(abortError(signal));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      joined.promise
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  /** Downloads `version`'s zip into a new folder in `tempDirectory`. */
  private async download(
    version: string,
    tempDirectory: string,
    opts?: Partial<InstallerParams>,
  ): Promise<string> {
    const mirror = { ...this.options.mirror, ...opts?.mirror };
    const signal = opts?.signal;
    try {
      return await electronDownload(version, {
        mirrorOptions: {
          mirror: mirror.electronMirror,
          nightlyMirror: mirror.electronNightlyMirror,
          ...(mirror.override
            ? {
                resolveAssetURL: async (asset: AssetDetails) =>
                  mirrorAssetUrl(mirror, asset),
              }
            : {}),
        },
        downloadOptions: {
          quiet: true,
          getProgressCallback: (progress: ProgressObject) =>
            opts?.progressCallback?.(progress),
          ...(signal ? { signal } : {}),
        },
        // Fiddle keeps its own copy, so leave the cache shared with other
        // tools alone. The temp file is ours to move and clean up.
        cacheMode: ElectronDownloadCacheMode.Bypass,
        tempDirectory,
        ...(this.options.downloader ? { downloader: this.options.downloader } : {}),
      });
    } catch (err) {
      if (signal?.aborted) throw abortError(signal);
      throw err;
    }
  }

  /** Resolves with the path of `version`'s zip, downloading it if needed. */
  private async ensureDownloadedImpl(
    version: string,
    opts: Partial<InstallerParams>,
  ): Promise<string> {
    const d = debug(`fiddle-core:Installer:${version}:ensureDownloadedImpl`);
    const { signal } = opts;
    throwIfAborted(signal);
    const { electronDownloads } = this.paths;
    const zipFile = path.join(electronDownloads, getZipName(version));

    const fetchZip = async () => {
      if (fs.existsSync(zipFile)) {
        // another process downloaded it while we waited for the lock
        if (this.state(version) === InstallState.missing) {
          this.setState(version, InstallState.downloaded);
        }
        return;
      }
      this.setState(version, InstallState.downloading);
      try {
        // Download next to the zips, so the move is a rename and a failed
        // download leaves nothing behind (@electron/get keeps its temp folder
        // on failure when it bypasses its cache). One a killed process left
        // behind goes in the sweep.
        await fs.promises.mkdir(electronDownloads, { recursive: true });
        // A download's folder keeps its creation mtime, so another host's is
        // only swept once no download could still be running in it.
        await this.sweep(electronDownloads, LEFTOVER_MAX_AGE_MS);
        const tempDir = await fs.promises.mkdtemp(
          path.join(electronDownloads, `.tmp-${Installer.leftoverTag(version)}`),
        );
        try {
          await rename(await this.download(version, tempDir, opts), zipFile);
        } finally {
          await removeBestEffort(tempDir);
        }
      } catch (err) {
        this.setState(version, InstallState.missing);
        throw err;
      }
      this.setState(version, InstallState.downloaded);
      d(`"${zipFile}" downloaded`);
    };

    if (this.state(version) === InstallState.missing || !fs.existsSync(zipFile)) {
      d(`"${zipFile}" does not exist; downloading now`);
      const lockPath = path.join(
        electronDownloads,
        '.locks',
        `${getZipName(version)}.lock`,
      );
      await withLock(lockPath, { signal }, fetchZip);
    } else {
      d(`"${zipFile}" exists; no need to download`);
    }

    return zipFile;
  }

  private ensureDownloaded(
    version: string,
    opts: Partial<InstallerParams>,
  ): Promise<string> {
    return this.shared(`download:${version}`, opts, (params) =>
      this.ensureDownloadedImpl(version, params),
    );
  }

  /** Extracts `zipPath` into `dir`, checking `signal` before and after. */
  private async extractZip(
    zipPath: string,
    dir: string,
    signal?: AbortSignal,
  ): Promise<void> {
    throwIfAborted(signal);
    await fs.promises.mkdir(dir, { recursive: true });
    try {
      await extractZip(zipPath, dir, signal);
    } catch (err) {
      if (signal?.aborted) throw abortError(signal);
      throw err;
    }
    throwIfAborted(signal);
  }

  public async install(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<string> {
    assertValidVersion(version);
    return this.shared(`install:${version}`, opts, (params) =>
      this.installPerVersion(version, params),
    );
  }

  private async installPerVersion(
    version: string,
    opts: Partial<InstallerParams>,
  ): Promise<string> {
    const d = debug(`fiddle-core:Installer:${version}:installPerVersion`);
    const { signal } = opts;
    const { electronVersions } = this.paths;
    const dir = this.versionDir(version);
    const exec = Installer.getExecPath(dir);
    const done = () => {
      this.setState(version, InstallState.installed);
      d(inspect({ exec, version }));
      return exec;
    };

    if (fs.existsSync(exec)) return done();

    // Download first, so the install lock is only held while extracting.
    const source = await this.ensureDownloaded(version, opts);

    return withLock(this.installLockPath(version), { signal }, async () => {
      // another process may have installed it while we waited for the lock
      if (fs.existsSync(exec)) return done();
      await this.sweep(electronVersions, LOCK_STALE_MS);

      const tmp = await fs.promises.mkdtemp(
        path.join(electronVersions, `.tmp-${Installer.leftoverTag(version)}`),
      );
      const originalState = this.state(version);
      this.setState(version, InstallState.installing);
      try {
        d(`installing from "${source}" via "${tmp}"`);
        await this.extractZip(source, tmp, signal);
        // a folder without an executable isn't a complete install
        if (fs.existsSync(dir)) await this.trash(version);
        await renameIntoPlace(tmp, dir);
      } catch (err) {
        await removeBestEffort(tmp);
        this.setState(version, originalState);
        throw err;
      }
      this.warming.set(
        version,
        warmExecutable(exec).finally(() => this.warming.delete(version)),
      );
      return done();
    });
  }
}
