import * as path from 'node:path';

import { IpcMainInvokeEvent, shell } from 'electron';

import { ipcMainManager } from './ipc';
import { exec, execFile } from './utils/exec';
import { IPackageManager, PMOperationOptions } from '../interfaces';
import { IpcEvents } from '../ipc-events';

let isNpmInstalled: boolean | null = null;
let isYarnInstalled: boolean | null = null;
let isSfwInstalled: boolean | null = null;

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
 * Checks if sfw (Socket Firewall) is installed.
 */
export async function getIsSfwInstalled(
  ignoreCache?: boolean,
): Promise<boolean> {
  if (isSfwInstalled !== null && !ignoreCache) return isSfwInstalled;

  const command = process.platform === 'win32' ? 'where.exe sfw' : 'which sfw';

  try {
    await exec(process.cwd(), command);
    isSfwInstalled = true;
    return true;
  } catch (error) {
    console.warn(`getIsSfwInstalled: "${command}" failed.`, error);
    isSfwInstalled = false;
    return false;
  }
}

/**
 * Installs given modules to a given folder.
 */
export async function addModules(
  { dir, packageManager, useSocketFirewall }: PMOperationOptions,
  ...names: Array<string>
): Promise<string> {
  const pm = packageManager === 'npm' ? 'npm' : 'yarn';
  const pmArgs =
    packageManager === 'npm'
      ? ['install', '-S', ...names]
      : names.length > 0
        ? ['add', ...names]
        : ['install'];

  // Use Socket Firewall if enabled and available
  if (useSocketFirewall) {
    const sfwAvailable = await getIsSfwInstalled();
    if (sfwAvailable) {
      // sfw wraps the package manager: sfw npm install ...
      return await execFile(dir, 'sfw', [pm, ...pmArgs]);
    }
    console.warn('Socket Firewall requested but sfw is not installed');
  }

  return await execFile(dir, pm, pmArgs);
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
      { dir, packageManager, useSocketFirewall }: PMOperationOptions,
      ...names: Array<string>
    ) => addModules({ dir, packageManager, useSocketFirewall }, ...names),
  );
  ipcMainManager.handle(
    IpcEvents.NPM_IS_PM_INSTALLED,
    (
      _: IpcMainInvokeEvent,
      packageManager: IPackageManager,
      ignoreCache?: boolean,
    ) => getIsPackageManagerInstalled(packageManager, ignoreCache),
  );
  ipcMainManager.handle(IpcEvents.NPM_IS_SFW_INSTALLED, () =>
    getIsSfwInstalled(),
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
