/**
 * The macOS privacy helper (native/disclaim). macOS charges a process's
 * camera, microphone and other privacy requests to its responsible process,
 * so a fiddle started by Electron Fiddle would use the app's grants. Fiddles
 * start through `fiddle-disclaim <electron> <args…>` instead, which disclaims
 * responsibility and execs Electron: the fiddle is its own responsible
 * process, and `child_process` sees an ordinary child. Its grants belong to
 * the Electron build it runs on (`com.github.Electron`), and downloaded builds
 * are ad hoc signed, so macOS asks again for each build.
 *
 * Packaged builds ship the helper at `<resources>/fiddle-disclaim`
 * (forge.config.ts); dev and test runs use
 * `native/disclaim/build/fiddle-disclaim`, which `sh native/disclaim/build.sh`
 * builds. Only macOS uses it.
 */
import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { ErrorCode, FiddleError } from '../../shared/errors';
import { tm } from '../i18n';
import { log } from '../log';

/** The file name of the helper; forge.config.ts ships it under this name. */
export const DISCLAIM_HELPER = 'fiddle-disclaim';

export interface DisclaimLocation {
  platform: NodeJS.Platform;
  packaged: boolean;
  resourcesPath: string;
  appPath: string;
  isExecutable?: (file: string) => boolean;
}

function isExecutableFile(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * The helper to start fiddles through, or undefined to start them directly:
 * off macOS, and in a dev or test build that hasn't built it. A packaged build
 * without it throws instead, because a direct start would give every fiddle
 * the app's privacy grants.
 */
export function resolveDisclaimHelper({
  platform,
  packaged,
  resourcesPath,
  appPath,
  isExecutable = isExecutableFile,
}: DisclaimLocation): string | undefined {
  if (platform !== 'darwin') return undefined;
  const file = packaged
    ? path.join(resourcesPath, DISCLAIM_HELPER)
    : path.join(appPath, 'native', 'disclaim', 'build', DISCLAIM_HELPER);
  if (isExecutable(file)) return file;
  if (packaged) {
    throw new FiddleError(
      ErrorCode.unavailable,
      tm('mainRun')('privacyHelperMissing', { path: file }),
    );
  }
  return undefined;
}

let warned = false;

/** `resolveDisclaimHelper` for this app. Logs once when a dev or test build starts fiddles directly. */
export function disclaimLauncher(): string | undefined {
  if (process.platform !== 'darwin') return undefined;
  const helper = resolveDisclaimHelper({
    platform: process.platform,
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
  });
  if (helper === undefined && !warned) {
    warned = true;
    log.warn(
      `The privacy helper is not built, so fiddles start with Electron Fiddle's privacy grants. Build it with: sh native/disclaim/build.sh`,
    );
  }
  return helper;
}
