import * as path from 'node:path';

import { IpcMainInvokeEvent, shell } from 'electron';

import { ipcMainManager } from './ipc';
import { exec, execFile } from './utils/exec';
import { IPackageManager, PMOperationOptions } from '../interfaces';
import { IpcEvents } from '../ipc-events';

let isNpmInstalled: boolean | null = null;
let isYarnInstalled: boolean | null = null;

/**
 * Checks if package manager is installed by checking if a binary
 * with that name can be found.
 */
export async function getIsPackageManagerInstalled(
  packageManager: IPackageManager,
  ignoreCache?: boolean,
): Promise<boolean> {
  if (packageManager === 'npm' && isNpmInstalled !== null && !ignoreCache)
    return isNpmInstalled;
  if (packageManager === 'yarn' && isYarnInstalled !== null && !ignoreCache)
    return isYarnInstalled;

  const command =
    process.platform === 'win32'
      ? `where.exe ${packageManager}`
      : `which ${packageManager}`;

  try {
    await exec(process.cwd(), command);
    if (packageManager === 'npm') {
      isNpmInstalled = true;
    } else {
      isYarnInstalled = true;
    }
    return true;
  } catch (error) {
    console.warn(`getIsPackageManagerInstalled: "${command}" failed.`, error);
    if (packageManager === 'npm') {
      isNpmInstalled = false;
    } else {
      isYarnInstalled = false;
    }
    return false;
  }
}

/**
 * Installs given modules to a given folder.
 */
export async function addModules(
  { dir, packageManager }: PMOperationOptions,
  ...names: Array<string>
): Promise<string> {
  const cmd = packageManager === 'npm' ? 'npm' : 'yarn';
  const args =
    packageManager === 'npm'
      ? ['install', '-S', ...names]
      : names.length > 0
        ? ['add', ...names]
        : ['install'];

  return await execFile(dir, cmd, args);
}

/**
 * Execute an "\{packageManager\} run" command
 */
export async function packageRun(
  { dir, packageManager }: PMOperationOptions,
  command: string,
): Promise<string> {
  const result = await exec(dir, `${packageManager} run ${command}`);

  shell.showItemInFolder(path.join(dir, 'out'));

  return result;
}

export async function setupNpm() {
  ipcMainManager.handle(
    IpcEvents.NPM_ADD_MODULES,
    (
      _: IpcMainInvokeEvent,
      { dir, packageManager }: PMOperationOptions,
      ...names: Array<string>
    ) => addModules({ dir, packageManager }, ...names),
  );
  ipcMainManager.handle(
    IpcEvents.NPM_IS_PM_INSTALLED,
    (
      _: IpcMainInvokeEvent,
      packageManager: IPackageManager,
      ignoreCache?: boolean,
    ) => getIsPackageManagerInstalled(packageManager, ignoreCache),
  );
  ipcMainManager.handle(
    IpcEvents.NPM_PACKAGE_RUN,
    (
      _: IpcMainInvokeEvent,
      { dir, packageManager }: PMOperationOptions,
      command: string,
    ) => packageRun({ dir, packageManager }, command),
  );
}
