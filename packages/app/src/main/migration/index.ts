import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { app, safeStorage } from 'electron';

import { log } from '../log';
import { writeAtomic } from '../persistence/json-store';
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

/** Runs right after `ready`, before any store (settings.json, state.json, …) is created. */
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
    // Not recorded as done: the next launch tries again.
    log.error('the import from the previous Electron Fiddle failed', error);
    return { firstLaunch: false, summary: {} };
  }
}

/** The copy of the old app's Electron versions finished. */
const VERSIONS_IMPORTED = 'electron-versions-imported';

/** Copies the old app's downloaded Electron versions into the cache, until a launch finishes it. Runs after startup. */
export function importElectronVersionsInBackground(): void {
  if (isTestMode()) return;
  const done = path.join(app.getPath('userData'), VERSIONS_IMPORTED);
  if (fs.existsSync(done)) return;
  let versionsDir: string;
  try {
    versionsDir = path.join(getCacheRoot(), 'electron');
  } catch (error) {
    log.warn('import: no cache folder for Electron versions', error);
    return;
  }
  importElectronVersions(path.join(app.getPath('userData'), 'electron-bin'), versionsDir)
    .then(async (versions) => {
      if (versions.length)
        log.info('import: Electron versions copied into the cache', versions);
      // Written last, and only when every copy worked, so a quit or a failed copy runs it again.
      await writeAtomic(done, `${new Date().toISOString()}\n`);
    })
    .catch((error: unknown) =>
      log.warn('import: copying Electron versions failed', error),
    );
}
