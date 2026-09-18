/**
 * The one-time import from the previous Electron Fiddle. main/index.ts awaits
 * `runMigration()` right after `ready`, before any store (settings.json,
 * state.json, …) is created. See ./import.ts.
 */
import os from 'node:os';
import path from 'node:path';

import { app, safeStorage } from 'electron';

import { log } from '../log';
import { getCacheRoot, isTestMode } from '../test-mode';
import { importElectronVersions, importOldApp, type ImportResult } from './import';
import { readOldLocalStorage } from './local-storage';

function osUserName(): string {
  try {
    return os.userInfo().username;
  } catch {
    return '';
  }
}

export async function runMigration(): Promise<ImportResult> {
  // Test runs never read machine data (and start from an empty userData anyway).
  if (isTestMode()) return { firstLaunch: false, summary: {} };
  const userData = app.getPath('userData');
  try {
    const result = await importOldApp({
      userData,
      home: os.homedir(),
      version: app.getVersion(),
      osUser: osUserName(),
      platform: process.platform,
      readLocalStorage: () => readOldLocalStorage(userData),
      safeStorage,
    });
    if (result.firstLaunch)
      log.info('first launch: import from the previous Electron Fiddle', result.summary);
    return result;
  } catch (error) {
    // Nothing was recorded, so the next launch tries again.
    log.error('the import from the previous Electron Fiddle failed', error);
    return { firstLaunch: false, summary: {} };
  }
}

/** Copies the old app's downloaded Electron versions into the cache. Runs after startup. */
export function importElectronVersionsInBackground(): void {
  let versionsDir: string;
  try {
    versionsDir = path.join(getCacheRoot(), 'electron');
  } catch (error) {
    log.warn('import: no cache folder for Electron versions', error);
    return;
  }
  importElectronVersions(path.join(app.getPath('userData'), 'electron-bin'), versionsDir)
    .then((versions) => {
      if (versions.length)
        log.info('import: Electron versions copied into the cache', versions);
    })
    .catch((error: unknown) =>
      log.warn('import: copying Electron versions failed', error),
    );
}
