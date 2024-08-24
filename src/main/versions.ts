import * as path from 'node:path';

import { ElectronVersions, Installer, SemVer } from '@electron/fiddle-core';
import { IpcMainEvent, app } from 'electron';
import * as fs from 'fs-extra';

import { ipcMainManager } from './ipc';
import releases from '../../static/releases.json';
import { InstallState, Version } from '../interfaces';
import { IpcEvents } from '../ipc-events';

let knownVersions: ElectronVersions;

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

export async function setupVersions() {
  knownVersions = await ElectronVersions.create(
    {
      versionsCache: path.join(app.getPath('userData'), 'releases.json'),
    },
    {
      initialVersions: releases,
    },
  );

  ipcMainManager.handle(
    IpcEvents.IS_RELEASED_MAJOR,
    (_: IpcMainEvent, version: number) => isReleasedMajor(version),
  );
  ipcMainManager.handle(IpcEvents.FETCH_VERSIONS, (_: IpcMainEvent) =>
    fetchVersions(),
  );
  ipcMainManager.on(IpcEvents.GET_LATEST_STABLE, (event) => {
    event.returnValue = getLatestStable();
  });
  ipcMainManager.on(IpcEvents.GET_LOCAL_VERSION_STATE, (event, ver) => {
    event.returnValue = getLocalVersionState(ver);
  });
  ipcMainManager.on(IpcEvents.GET_OLDEST_SUPPORTED_MAJOR, (event) => {
    event.returnValue = getOldestSupportedMajor();
  });
  ipcMainManager.on(IpcEvents.GET_RELEASED_VERSIONS, (event) => {
    event.returnValue = getReleasedVersions();
  });
  ipcMainManager.handle(
    IpcEvents.GET_RELEASE_INFO,
    (_: IpcMainEvent, version) => knownVersions.getReleaseInfo(version),
  );

  return knownVersions;
}
