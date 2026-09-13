import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';

import { extract } from '@electron-internal/extract-zip';
import { download as electronDownload } from '@electron/get';
import semver from 'semver';

import { debug } from './debug.js';
import { FiddleCoreError, abortError, throwIfAborted } from './errors.js';
import { renameIntoPlace, withNoAsar } from './fs-util.js';
import { withLock } from './lock.js';
import { DefaultPaths, type Paths } from './paths.js';

function getZipName(version: string): string {
  return `electron-v${version}-${process.platform}-${process.arch}.zip`;
}

function assertValidVersion(version: string): void {
  if (!semver.valid(version)) {
    throw new FiddleCoreError(
      'invalid-version',
      `Invalid Electron version: "${version}"`,
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function extractZip(zipFile: string, dir: string): Promise<void> {
  try {
    await withNoAsar(() => extract(zipFile, { dir }));
  } catch (err) {
    throw new FiddleCoreError('extract-failed', errorMessage(err), { cause: err });
  }
}

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
  /** Cancels the download or install with an `aborted` {@link FiddleCoreError}. */
  signal?: AbortSignal;
}

/**
 * - `current` (default): one version at a time in `paths.electronInstall`.
 *   Installing a version replaces the previous one.
 * - `per-version`: each version gets its own immutable folder in
 *   `paths.electronVersions`. It is extracted to a temp folder and renamed into
 *   place, so it is either complete or absent. Several versions can be
 *   installed at once.
 */
export type InstallLayout = 'current' | 'per-version';

export interface InstallerOptions {
  /** Default: `current`. */
  layout?: InstallLayout;
  /** Guard downloads and installs with cross-process lock files. Default: `false`. */
  locks?: boolean;
  /** Mirrors used when a call doesn't pass its own `mirror`. */
  mirror?: Partial<Mirrors>;
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
    locks: boolean;
    mirror: Partial<Mirrors>;
  }>;
  private readonly stateMap = new Map<string, InstallState>();

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
      locks: options.locks ?? false,
      mirror: { ...options.mirror },
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

  private rebuildStates() {
    this.stateMap.clear();

    // already downloaded...
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

    // installed...
    if (this.options.layout === 'per-version') {
      try {
        for (const name of fs.readdirSync(this.paths.electronVersions)) {
          if (semver.valid(name)) this.setState(name, InstallState.installed);
        }
      } catch {
        // no versions directory yet
      }
    } else {
      try {
        const versionFile = path.join(this.paths.electronInstall, 'version');
        const version = fs.readFileSync(versionFile, 'utf8').trim();
        this.setState(version, InstallState.installed);
      } catch {
        // no current version
      }
    }

    this.installing.forEach((version) => {
      this.setState(version, InstallState.installing);
    });

    // being downloaded now...
    for (const version of this.downloading.keys()) {
      this.setState(version, InstallState.downloading);
    }
  }

  /** Removes an Electron download or Electron install from the disk. */
  public async remove(version: string): Promise<void> {
    const d = debug('fiddle-core:Installer:remove');
    d(version);
    assertValidVersion(version);
    let isBinaryDeleted: boolean;
    // utility to re-run removal functions upon failure
    // due to windows filesystem lockfile jank
    const rerunner = async (
      path: string,
      func: (path: string) => void,
      counter = 1,
    ): Promise<boolean> => {
      try {
        func(path);
        return true;
      } catch (error) {
        console.warn(
          `Installer: failed to run ${func.name} for ${version}, but failed`,
          error,
        );
        if (counter < 4) {
          console.log(`Installer: Trying again to run ${func.name}`);
          await rerunner(path, func, counter + 1);
        }
      }
      return false;
    };

    const binaryCleaner = (path: string) => {
      if (fs.existsSync(path)) {
        const { noAsar } = process;
        try {
          process.noAsar = true;
          fs.rmSync(path, { recursive: true, force: true });
        } finally {
          process.noAsar = noAsar;
        }
      }
    };
    // get the zip path
    const zipPath = path.join(this.paths.electronDownloads, getZipName(version));
    // Or, maybe the version was already installed and kept in file system
    const preInstalledPath = path.join(this.paths.electronDownloads, version);

    const isZipDeleted = await rerunner(zipPath, binaryCleaner);
    const isPathDeleted = await rerunner(preInstalledPath, binaryCleaner);

    // maybe uninstall it
    if (this.options.layout === 'per-version') {
      isBinaryDeleted = await this.removeVersionDir(version);
    } else if (this.installedVersion === version) {
      isBinaryDeleted = await rerunner(this.paths.electronInstall, binaryCleaner);
    } else {
      // If the current version binary doesn't exists
      isBinaryDeleted = true;
    }

    if ((isZipDeleted || isPathDeleted) && isBinaryDeleted) {
      this.setState(version, InstallState.missing);
    } else {
      // Ideally the execution shouldn't reach this point
      console.warn(`Installer: Failed to remove version ${version}`);
    }
  }

  /** Removes a per-version folder by moving it aside first, so it is never half-deleted. */
  private async removeVersionDir(version: string): Promise<boolean> {
    const dir = this.versionDir(version);
    const removeIt = async () => {
      if (!fs.existsSync(dir)) return;
      const trash = path.join(
        this.paths.electronVersions,
        `.rm-${version}-${process.pid}-${Date.now()}`,
      );
      await fs.promises.rename(dir, trash);
      await withNoAsar(() => fs.promises.rm(trash, { recursive: true, force: true }));
    };
    try {
      await (this.options.locks ? withLock(`${dir}.lock`, {}, removeIt) : removeIt());
      return true;
    } catch (err) {
      console.warn(`Installer: failed to remove ${dir}`, err);
      return false;
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

  private async download(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<string> {
    let pctDone = 0;
    const getProgressCallback = (progress: ProgressObject) => {
      if (opts?.progressCallback) {
        // Call the user passed callback function
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
      });
    } catch (err) {
      if (signal?.aborted) throw abortError(signal);
      throw new FiddleCoreError('download-failed', errorMessage(err), { cause: err });
    }
  }

  private async ensureDownloadedImpl(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<ElectronBinary> {
    const d = debug(`fiddle-core:Installer:${version}:ensureDownloadedImpl`);
    assertValidVersion(version);
    throwIfAborted(opts?.signal);
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
      if (this.options.locks && fs.existsSync(zipFile)) {
        // another process downloaded it while we waited for the lock
        if (this.state(version) === InstallState.missing) {
          this.setState(version, InstallState.downloaded);
        }
        return;
      }
      this.setState(version, InstallState.downloading);
      try {
        const tempFile = await this.download(version, opts);
        await fs.promises.mkdir(electronDownloads, { recursive: true });
        try {
          await fs.promises.rename(tempFile, zipFile);
        } catch (err) {
          // cross-device move not permitted, fallback to copy
          if (err instanceof Error && 'code' in err && err.code === 'EXDEV') {
            const partial = `${zipFile}.${process.pid}.partial`;
            await fs.promises.copyFile(tempFile, partial);
            await fs.promises.rename(partial, zipFile);
            await fs.promises.rm(tempFile);
          } else {
            throw err;
          }
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
      if (this.options.locks) {
        await withLock(`${zipFile}.lock`, { signal: opts?.signal }, fetchZip);
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

  /** map of version string to currently-running active Promise */
  private downloading = new Map<string, Promise<ElectronBinary>>();

  public async ensureDownloaded(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<ElectronBinary> {
    const { downloading: promises } = this;
    let promise = promises.get(version);
    if (promise) return promise;

    promise = this.ensureDownloadedImpl(version, opts).finally(() =>
      promises.delete(version),
    );
    promises.set(version, promise);
    return promise;
  }

  /** keep a track of all currently installing versions */
  private installing = new Set<string>();

  /** per-version layout: map of version string to currently-running install */
  private installPromises = new Map<string, Promise<string>>();

  public async install(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<string> {
    if (this.options.layout === 'per-version') {
      assertValidVersion(version);
      let promise = this.installPromises.get(version);
      if (!promise) {
        promise = this.installPerVersion(version, opts).finally(() =>
          this.installPromises.delete(version),
        );
        this.installPromises.set(version, promise);
      }
      return promise;
    }

    const d = debug(`fiddle-core:Installer:${version}:install`);
    const { electronInstall } = this.paths;
    const isVersionInstalling = this.installing.has(version);
    const electronExec = Installer.getExecPath(electronInstall);

    if (isVersionInstalling) {
      throw new FiddleCoreError(
        'already-installing',
        `Currently installing "${version}"`,
      );
    }

    this.installing.add(version);

    try {
      // see if the current version (if any) is already `version`
      const { installedVersion } = this;
      if (installedVersion === version) {
        d(`already installed`);
      } else {
        const installIt = async () => {
          const { path: source, alreadyExtracted } = await this.ensureDownloaded(
            version,
            opts,
          );
          throwIfAborted(opts?.signal);

          // An unzipped version already exists at `electronDownload` path
          if (alreadyExtracted) {
            await this.installVersionImpl(version, source, async () => {
              // Simply copy over the files from preinstalled version to `electronInstall`
              await withNoAsar(() =>
                fs.promises.cp(source, electronInstall, {
                  recursive: true,
                }),
              );
            });
          } else {
            await this.installVersionImpl(version, source, () =>
              extractZip(source, electronInstall),
            );
          }
        };
        if (this.options.locks) {
          await withLock(`${electronInstall}.lock`, { signal: opts?.signal }, installIt);
        } else {
          await installIt();
        }
      }
    } finally {
      this.installing.delete(version);
    }

    // return the full path to the electron executable
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
      await withNoAsar(() =>
        fs.promises.rm(electronInstall, {
          recursive: true,
          force: true,
        }),
      );

      // Call the user defined callback which unzips/copies files content
      if (installCallback) {
        await installCallback();
      }
    } catch (err) {
      this.setState(version, originalState);
      throw err;
    }

    if (installedVersion) {
      this.setState(installedVersion, InstallState.downloaded);
    }
    this.setState(version, InstallState.installed);
  }

  private async installPerVersion(
    version: string,
    opts?: Partial<InstallerParams>,
  ): Promise<string> {
    const d = debug(`fiddle-core:Installer:${version}:installPerVersion`);
    const signal = opts?.signal;
    const dir = this.versionDir(version);
    const exec = Installer.getExecPath(dir);
    const done = () => {
      this.setState(version, InstallState.installed);
      d(inspect({ exec, version }));
      return exec;
    };

    if (fs.existsSync(dir)) return done();
    throwIfAborted(signal);

    const installIt = async () => {
      // another process may have installed it while we waited for the lock
      if (fs.existsSync(dir)) return done();

      const { path: source, alreadyExtracted } = await this.ensureDownloaded(
        version,
        opts,
      );
      throwIfAborted(signal);

      const originalState = this.state(version);
      this.installing.add(version);
      this.setState(version, InstallState.installing);
      await fs.promises.mkdir(this.paths.electronVersions, { recursive: true });
      const tmp = await fs.promises.mkdtemp(
        path.join(this.paths.electronVersions, `.tmp-${version}-`),
      );
      try {
        d(`installing from "${source}" via "${tmp}"`);
        if (alreadyExtracted) {
          await withNoAsar(() =>
            fs.promises.cp(source, tmp, { recursive: true, verbatimSymlinks: true }),
          );
        } else {
          await extractZip(source, tmp);
        }
        throwIfAborted(signal);
        await renameIntoPlace(tmp, dir);
      } catch (err) {
        await withNoAsar(() => fs.promises.rm(tmp, { recursive: true, force: true }));
        this.setState(version, originalState);
        throw err;
      } finally {
        this.installing.delete(version);
      }
      return done();
    };

    return this.options.locks
      ? withLock(`${dir}.lock`, { signal }, installIt)
      : installIt();
  }
}
