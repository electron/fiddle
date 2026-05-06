import * as path from 'node:path';

import { ElectronVersions, Installer, SemVer } from '@electron/fiddle-core';
import { IpcMainInvokeEvent, app } from 'electron';
import fs from 'fs-extra';

import { ipcMainManager } from './ipc';
import releases from '../../static/releases.json';
import { InstallState, Version } from '../interfaces';
import { IpcEvents } from '../ipc-events';

let knownVersions: ElectronVersions;
let localVersions: Array<Version> = [];
let localVersionsPath: string;
let migrated = false;

/**
 * Helper to check if this version is from a released major branch.
 *
 * This way when we have a local version of Electron like '999.0.0'
 * we'll know to not try & download 999-x-y.zip from GitHub :D
 *
 * @param major - Electron major version number
 * @returns true if there are releases with that major version
 */
export function isReleasedMajor(major: number): boolean {
  return knownVersions.inMajor(major).length > 0;
}

export function getOldestSupportedMajor(): number | undefined {
  const NUM_BRANCHES = parseInt(process.env.NUM_STABLE_BRANCHES || '');

  if (!Number.isNaN(NUM_BRANCHES)) {
    return knownVersions.stableMajors.slice(-NUM_BRANCHES)[0];
  }

  return knownVersions.supportedMajors[0];
}

export function getLatestStable(): SemVer | undefined {
  return knownVersions.latestStable;
}

export function getReleasedVersions(): Array<Version> {
  // Don't support anything older than 0.30 (Aug 2015).
  // The oldest version known to releases.json.org is 0.20,
  // Pre-0.24.0 versions were technically 'atom-shell' and cannot
  // be downloaded with @electron/get.
  // TODO(dsanders11): upstream this logic to @electron/fiddle-core
  return knownVersions.versions
    .filter((ver) => !ver.version.startsWith('0.2'))
    .map(({ version }) => ({ version }));
}

/**
 * Gets the current state of a specific version
 * Valid local electron builds are marked as `installed`
 */
export function getLocalVersionState(ver: Version): InstallState {
  const { localPath } = ver;
  if (localPath !== undefined) {
    const dir = Installer.getExecPath(localPath);
    if (fs.existsSync(dir)) {
      return InstallState.installed;
    }
  }

  return InstallState.missing;
}

export async function fetchVersions(): Promise<Version[]> {
  await knownVersions.fetch();
  return getReleasedVersions();
}

/**
 * Load local versions from disk.
 */
function loadLocalVersions(): void {
  try {
    if (fs.existsSync(localVersionsPath)) {
      const raw = fs.readFileSync(localVersionsPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        migrated = !!data.migrated;
        localVersions = Array.isArray(data.versions)
          ? data.versions.filter(
              (v: any) =>
                v &&
                typeof v.version === 'string' &&
                typeof v.localPath === 'string',
            )
          : [];
      }
    }
  } catch (err) {
    console.warn('Failed to load local versions:', err);
  }
}

/**
 * Save local versions to disk.
 */
function persistLocalVersions(): void {
  try {
    fs.writeFileSync(
      localVersionsPath,
      JSON.stringify({ migrated, versions: localVersions }, null, 2),
    );
  } catch (err) {
    console.warn('Failed to save local versions:', err);
  }
}

/**
 * Get the stored local versions.
 */
export function getLocalVersions(): Array<Version> {
  return localVersions;
}

/**
 * Get the Version (if any) that is located at localPath.
 */
export function getLocalVersionForPath(
  folderPath: string,
): Version | undefined {
  return localVersions.find((v) => v.localPath === folderPath);
}

// Pending local paths awaiting confirmation from the renderer.
// Keyed by opaque token, value is the validated folder path.
const pendingLocalPaths = new Map<string, string>();

/**
 * Store a validated local path under an opaque token.
 * Called by the dialog handler after the user selects a folder.
 * If the path is already pending, returns the existing token.
 */
export function setPendingLocalPath(token: string, folderPath: string): string {
  for (const [existingToken, existingPath] of pendingLocalPaths) {
    if (existingPath === folderPath) {
      return existingToken;
    }
  }
  pendingLocalPaths.set(token, folderPath);
  return token;
}

/**
 * Cancel a pending local path token without adding it.
 */
export function cancelPendingLocalPath(token: string): void {
  pendingLocalPaths.delete(token);
}

/**
 * Add a local version using a previously-issued token. Returns the updated list.
 * The token must have been issued by selectLocalVersion (LOAD_LOCAL_VERSION_FOLDER).
 */
export function addLocalVersion(token: string, name: string): Array<Version> {
  const localPath = pendingLocalPaths.get(token);
  if (!localPath) {
    return localVersions;
  }
  pendingLocalPaths.delete(token);

  if (!localVersions.find((v) => v.localPath === localPath)) {
    const version = `0.0.0-local.${Date.now()}`;
    localVersions.push({ version, localPath, name });
    persistLocalVersions();
  }
  return localVersions;
}

/**
 * Remove a local version by its version key. Returns the updated list.
 */
export function removeLocalVersion(version: string): Array<Version> {
  localVersions = localVersions.filter((v) => v.version !== version);
  persistLocalVersions();
  return localVersions;
}

/**
 * One-time migration of local versions from the renderer's localStorage
 * to the main process store. Returns true if the migration was accepted,
 * false if it was already performed previously.
 */
export function migrateLocalVersions(versions: Array<Version>): boolean {
  if (migrated) {
    return false;
  }

  // Validate and merge incoming versions
  const validVersions = versions.filter(
    (v) =>
      v &&
      typeof v.version === 'string' &&
      v.version.length > 0 &&
      typeof v.localPath === 'string' &&
      v.localPath.length > 0,
  );

  for (const ver of validVersions) {
    if (!localVersions.find((v) => v.localPath === ver.localPath)) {
      localVersions.push(ver);
    }
  }

  migrated = true;
  persistLocalVersions();

  return true;
}

export async function setupVersions() {
  knownVersions = await ElectronVersions.create({
    initialVersions: releases,
    paths: {
      versionsCache: path.join(app.getPath('userData'), 'releases.json'),
    },
  });

  // Initialize local versions storage
  localVersionsPath = path.join(app.getPath('userData'), 'local-versions.json');
  loadLocalVersions();

  ipcMainManager.handle(
    IpcEvents.IS_RELEASED_MAJOR,
    (_: IpcMainInvokeEvent, version: number) => isReleasedMajor(version),
  );
  ipcMainManager.handle(IpcEvents.FETCH_VERSIONS, (_: IpcMainInvokeEvent) =>
    fetchVersions(),
  );
  ipcMainManager.on(IpcEvents.GET_LATEST_STABLE, (event) => {
    event.returnValue = getLatestStable();
  });
  ipcMainManager.on(IpcEvents.GET_LOCAL_VERSION_STATE, (event, ver) => {
    event.returnValue = getLocalVersionState(ver);
  });
  ipcMainManager.on(IpcEvents.GET_LOCAL_VERSIONS, (event) => {
    event.returnValue = getLocalVersions();
  });
  ipcMainManager.on(
    IpcEvents.ADD_LOCAL_VERSION,
    (event, token: string, name: string) => {
      event.returnValue = addLocalVersion(token, name);
    },
  );
  ipcMainManager.on(
    IpcEvents.REMOVE_LOCAL_VERSION,
    (event, version: string) => {
      event.returnValue = removeLocalVersion(version);
    },
  );
  ipcMainManager.on(
    IpcEvents.CANCEL_PENDING_LOCAL_VERSION,
    (event, token: string) => {
      cancelPendingLocalPath(token);
      event.returnValue = undefined;
    },
  );
  ipcMainManager.on(
    IpcEvents.MIGRATE_LOCAL_VERSIONS,
    (event, versions: Version[]) => {
      event.returnValue = migrateLocalVersions(versions);
    },
  );
  ipcMainManager.on(IpcEvents.GET_OLDEST_SUPPORTED_MAJOR, (event) => {
    event.returnValue = getOldestSupportedMajor();
  });
  ipcMainManager.on(IpcEvents.GET_RELEASED_VERSIONS, (event) => {
    event.returnValue = getReleasedVersions();
  });
  ipcMainManager.handle(
    IpcEvents.GET_RELEASE_INFO,
    (_: IpcMainInvokeEvent, version) => knownVersions.getReleaseInfo(version),
  );

  return knownVersions;
}
