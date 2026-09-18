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

import {
  type ErrorMode,
  FiddleCoreError,
  abortError,
  throwIfAborted,
  wrapError,
} from './errors.js';
import { extractZip } from './extract.js';
import {
  copyFolder,
  remove,
  removeBestEffort,
  rename,
  renameIntoPlace,
  safeHostname,
} from './fs-util.js';
import { LOCK_STALE_MS, isProcessAlive, withLock } from './lock.js';
import { DefaultPaths, type Paths } from './paths.js';

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

/**
 * Extracts the zip at `zipPath` into `destDir`, which exists and is empty.
 * `signal` aborts once no caller is waiting for the install any more.
 */
export type ExtractFunction = (
  zipPath: string,
  destDir: string,
  signal?: AbortSignal,
) => Promise<void>;

/** Written into `paths.electronInstall` once an install into it is complete. */
const INSTALLED_MARKER = '.fiddle-core-installed';

// Temp and trash folders in `electronVersions` are named
// `.tmp-<version>_<host>_<pid>_<random>` and `.rm-…`, so a sweep can tell
// whether their owner is gone. Neither a version nor a host contains `_`.
const LEFTOVER_RE = /^\.(?:tmp|rm)-.+_([A-Za-z0-9.-]+)_(\d+)_[A-Za-z0-9]+$/;

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
}

export interface ElectronBinary {
  path: string;
  alreadyExtracted: boolean; // to check if it's kept as zipped or not
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

/**
 * - `current` (default): one version at a time in `paths.electronInstall`.
 *   Installing a version replaces the previous one.
 * - `per-version`: each version gets its own immutable folder in
 *   `paths.electronVersions`. It is extracted to a temp folder and renamed into
 *   place, so it is either complete or absent. Several versions can be
 *   installed at once, and downloads and installs take cross-process locks, so
 *   several processes can share the cache.
 */
export type InstallLayout = 'current' | 'per-version';

export interface InstallerOptions {
  /** Default: `current`. */
  layout?: InstallLayout;
  /**
   * @deprecated Ignored. The `per-version` layout always uses locks, and the
   * `current` layout never does.
   */
  locks?: boolean;
  /** Mirrors used when a call doesn't pass its own `mirror`. */
  mirror?: Partial<Mirrors>;
  /** See {@link ErrorMode}. Default: `legacy`. */
  errors?: ErrorMode;
  /** Extracts a downloaded zip. The default is a native extractor. */
  extract?: ExtractFunction;
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
 * With the default `current` layout, the installed version is unzipped into
 * `paths.electronInstall`. Only one version is installed at a time --
 * installing a new version overwrites the current one in
 * `paths.electronInstall`. See {@link InstallLayout} for the `per-version`
 * layout.
 *
 * See {@link DefaultPaths} for the default paths.
 */
export class Installer extends EventEmitter {
  private readonly paths: Readonly<Required<Paths>>;
  private readonly options: Readonly<{
    layout: InstallLayout;
    mirror: Partial<Mirrors>;
    errors: ErrorMode | undefined;
    extract: ExtractFunction;
    downloader: InstallerOptions['downloader'];
  }>;
  private readonly stateMap = new Map<string, InstallState>();
  /** Downloads and per-version installs in flight, keyed `download:<version>` and `install:<version>`. */
  private readonly inflight = new Map<string, SharedTask<unknown>>();
  /** Versions being installed (`current` layout). */
  private readonly installing = new Set<string>();

  constructor(pathsIn: Partial<Paths> = {}, options: InstallerOptions = {}) {
    super();
    const paths = { ...DefaultPaths, ...pathsIn };
    this.paths = Object.freeze({
      ...paths,
      electronVersions:
        paths.electronVersions ??
        path.join(path.dirname(paths.electronInstall), 'versions'),
    });
    this.options = Object.freeze({
      layout: options.layout ?? 'current',
      mirror: { ...options.mirror },
      errors: options.errors,
      extract: options.extract ?? extractZip,
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

  /** The `per-version` layout locks downloads and installs across processes. */
  private get locked(): boolean {
    return this.options.layout === 'per-version';
  }

  private versionDir(version: string): string {
    return path.join(this.paths.electronVersions, version);
  }

  private installLockPath(version: string): string {
    return path.join(this.paths.electronVersions, '.locks', `${version}.lock`);
  }

  private rebuildStates() {
    this.stateMap.clear();

    const str = `^electron-v(.*)-${process.platform}-${process.arch}.zip$`;
    const reg = new RegExp(str);
    try {
      for (const file of fs.readdirSync(this.paths.electronDownloads)) {
        const match = reg.exec(file);
        if (match?.[1]) {
          this.setState(match[1], InstallState.downloaded);
        } else {
          // Case when the download path already has the unzipped electron version
          const versionFile = path.join(this.paths.electronDownloads, file, 'version');

          if (fs.existsSync(versionFile)) {
            const version = fs.readFileSync(versionFile, 'utf8').trim();
            if (semver.valid(version)) {
              this.setState(version, InstallState.downloaded);
            }
          }
        }
      }
    } catch {
      // no download directory yet
    }

    if (this.options.layout === 'per-version') {
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
    } else {
      try {
        const { electronInstall } = this.paths;
        const versionFile = path.join(electronInstall, 'version');
        const version = fs.readFileSync(versionFile, 'utf8').trim();
        // without the marker, the install may be partial
        const complete = fs.existsSync(path.join(electronInstall, INSTALLED_MARKER));
        this.setState(
          version,
          complete ? InstallState.installed : InstallState.downloaded,
        );
      } catch {
        // no current version
      }
    }

    this.installing.forEach((version) => {
      this.setState(version, InstallState.installing);
    });
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
    // a download folder may hold an unzipped version instead of a zip
    const preInstalledPath = path.join(this.paths.electronDownloads, version);
    const downloadsRemoved = [await removed(zipPath), await removed(preInstalledPath)];

    let installRemoved = true;
    if (this.options.layout === 'per-version') {
      installRemoved = await this.removeVersionDir(version);
    } else if (this.installedVersion === version) {
      installRemoved = await removed(this.paths.electronInstall);
    }

    if (installRemoved) {
      this.setState(
        version,
        downloadsRemoved.every(Boolean) ? InstallState.missing : InstallState.downloaded,
      );
    }
  }

  /** Removes a per-version folder. It counts as removed once it is moved aside. */
  private async removeVersionDir(version: string): Promise<boolean> {
    const dir = this.versionDir(version);
    try {
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
   * Deletes temp and trash folders left in `electronVersions` by a process
   * that has died (on this host) or that are older than {@link LOCK_STALE_MS}
   * (from other hosts).
   */
  private async sweep(): Promise<void> {
    const dir = this.paths.electronVersions;
    const host = safeHostname();
    for (const name of await fs.promises.readdir(dir).catch(() => [])) {
      const match = LEFTOVER_RE.exec(name);
      if (!match) continue;
      const entry = path.join(dir, name);
      try {
        const gone =
          match[1] === host
            ? !isProcessAlive(Number(match[2]))
            : Date.now() - (await fs.promises.stat(entry)).mtimeMs > LOCK_STALE_MS;
        if (gone) await removeBestEffort(entry);
      } catch {
        // already deleted
      }
    }
  }

  /** The current Electron installation, if any. */
  public get installedVersion(): string | undefined {
    for (const [version, state] of this.stateMap)
      if (state === InstallState.installed) return version;
  }

  /** Every installed version. With the `current` layout, at most one. */
  public get installedVersions(): string[] {
    return [...this.stateMap]
      .filter(([, state]) => state === InstallState.installed)
      .map(([version]) => version);
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

  private async download(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<string> {
    let pctDone = 0;
    const getProgressCallback = (progress: ProgressObject) => {
      if (opts?.progressCallback) {
        opts.progressCallback(progress);
      }
      const pct = Math.round(progress.percent * 100);
      if (pctDone + 10 <= pct) {
        const emoji = pct >= 100 ? '🏁' : '⏳';
        // FIXME(anyone): is there a better place than console.log for this?
        console.log(`${emoji} downloading ${version} - ${pct}%`);
        pctDone = pct;
      }
    };
    const mirror = { ...this.options.mirror, ...opts?.mirror };
    const signal = opts?.signal;
    try {
      return await electronDownload(version, {
        mirrorOptions: {
          mirror: mirror.electronMirror,
          nightlyMirror: mirror.electronNightlyMirror,
        },
        downloadOptions: {
          quiet: true,
          getProgressCallback,
          ...(signal ? { signal } : {}),
        },
        // Fiddle keeps its own copy, so leave the cache shared with other
        // tools alone. The temp file is ours to move and clean up.
        cacheMode: ElectronDownloadCacheMode.Bypass,
        ...(this.options.downloader ? { downloader: this.options.downloader } : {}),
      });
    } catch (err) {
      if (signal?.aborted) throw abortError(signal);
      throw wrapError(this.options.errors, 'download-failed', err);
    }
  }

  private async ensureDownloadedImpl(
    version: string,
    opts: Partial<InstallerParams>,
  ): Promise<ElectronBinary> {
    const d = debug(`fiddle-core:Installer:${version}:ensureDownloadedImpl`);
    const { signal } = opts;
    throwIfAborted(signal);
    const { electronDownloads } = this.paths;
    const zipFile = path.join(electronDownloads, getZipName(version));
    const zipFileExists = fs.existsSync(zipFile);

    const state = this.state(version);

    if (state === InstallState.downloaded) {
      const preInstalledPath = path.join(electronDownloads, version);
      if (!zipFileExists && fs.existsSync(preInstalledPath)) {
        return {
          path: preInstalledPath,
          alreadyExtracted: true,
        };
      }
    }

    const fetchZip = async () => {
      if (this.locked && fs.existsSync(zipFile)) {
        // another process downloaded it while we waited for the lock
        if (this.state(version) === InstallState.missing) {
          this.setState(version, InstallState.downloaded);
        }
        return;
      }
      this.setState(version, InstallState.downloading);
      try {
        const tempFile = await this.download(version, opts);
        try {
          await fs.promises.mkdir(electronDownloads, { recursive: true });
          try {
            await rename(tempFile, zipFile);
          } catch (err) {
            // cross-device move not permitted, fallback to copy
            if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
            const partial = `${zipFile}.${process.pid}.partial`;
            await fs.promises.copyFile(tempFile, partial);
            await rename(partial, zipFile);
          }
        } finally {
          await removeBestEffort(path.dirname(tempFile));
        }
      } catch (err) {
        this.setState(version, InstallState.missing);
        throw err;
      }
      this.setState(version, InstallState.downloaded);
      d(`"${zipFile}" downloaded`);
    };

    if (state === InstallState.missing || !zipFileExists) {
      d(`"${zipFile}" does not exist; downloading now`);
      if (this.locked) {
        const lockPath = path.join(
          electronDownloads,
          '.locks',
          `${getZipName(version)}.lock`,
        );
        await withLock(lockPath, { signal }, fetchZip);
      } else {
        await fetchZip();
      }
    } else {
      d(`"${zipFile}" exists; no need to download`);
    }

    return {
      path: zipFile,
      alreadyExtracted: false,
    };
  }

  public async ensureDownloaded(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<ElectronBinary> {
    assertValidVersion(version);
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
      await this.options.extract(zipPath, dir, signal);
    } catch (err) {
      if (signal?.aborted) throw abortError(signal);
      throw wrapError(this.options.errors, 'extract-failed', err);
    }
    throwIfAborted(signal);
  }

  public async install(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<string> {
    if (this.options.layout === 'per-version') {
      assertValidVersion(version);
      return this.shared(`install:${version}`, opts, (params) =>
        this.installPerVersion(version, params),
      );
    }

    const d = debug(`fiddle-core:Installer:${version}:install`);
    const { electronInstall } = this.paths;
    const electronExec = Installer.getExecPath(electronInstall);

    // every version installs into the same folder
    const [busy] = this.installing;
    if (busy !== undefined) {
      throw new FiddleCoreError('already-installing', `Currently installing "${busy}"`);
    }

    this.installing.add(version);

    try {
      const { installedVersion } = this;
      if (installedVersion === version) {
        d(`already installed`);
      } else {
        const { path: source, alreadyExtracted } = await this.ensureDownloaded(
          version,
          opts,
        );
        throwIfAborted(opts?.signal);

        await this.installVersionImpl(version, source, async () => {
          if (alreadyExtracted) {
            // already unzipped in the downloads folder, so copy it over
            await copyFolder(source, electronInstall);
          } else {
            await this.extractZip(source, electronInstall, opts?.signal);
          }
          await fs.promises.writeFile(path.join(electronInstall, INSTALLED_MARKER), '');
        });
      }
    } finally {
      this.installing.delete(version);
    }

    d(inspect({ electronExec, version }));
    return electronExec;
  }

  private async installVersionImpl(
    version: string,
    source: string,
    installCallback: () => Promise<void> | void,
  ): Promise<void> {
    const {
      paths: { electronInstall },
      installedVersion,
    } = this;
    const d = debug(`fiddle-core:Installer:${version}:install`);

    const originalState = this.state(version);
    this.setState(version, InstallState.installing);
    try {
      d(`installing from "${source}"`);
      await remove(electronInstall);
      await installCallback();
    } catch (err) {
      this.setState(version, originalState);
      throw err;
    } finally {
      // the previous version's files are gone or incomplete
      if (installedVersion) this.setState(installedVersion, InstallState.downloaded);
    }
    this.setState(version, InstallState.installed);
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
    const { path: source, alreadyExtracted } = await this.ensureDownloaded(version, opts);

    return withLock(this.installLockPath(version), { signal }, async () => {
      // another process may have installed it while we waited for the lock
      if (fs.existsSync(exec)) return done();
      await this.sweep();

      const tmp = await fs.promises.mkdtemp(
        path.join(electronVersions, `.tmp-${Installer.leftoverTag(version)}`),
      );
      const originalState = this.state(version);
      this.setState(version, InstallState.installing);
      try {
        d(`installing from "${source}" via "${tmp}"`);
        if (alreadyExtracted) {
          throwIfAborted(signal);
          await copyFolder(source, tmp, { verbatimSymlinks: true });
        } else {
          await this.extractZip(source, tmp, signal);
        }
        throwIfAborted(signal);
        // a folder without an executable isn't a complete install
        if (fs.existsSync(dir)) await this.trash(version);
        await renameIntoPlace(tmp, dir);
      } catch (err) {
        await removeBestEffort(tmp);
        this.setState(version, originalState);
        throw err;
      }
      return done();
    });
  }
}
