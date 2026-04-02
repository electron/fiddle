import * as fs from 'node:fs';
import * as path from 'node:path';

import { IpcMainInvokeEvent, shell } from 'electron';

import { ipcMainManager } from './ipc';
import { exec, execFile } from './utils/exec';
import { IPackageManager, PMOperationOptions } from '../interfaces';
import { IpcEvents } from '../ipc-events';

let isNpmInstalled: boolean | null = null;
let isYarnInstalled: boolean | null = null;
let sfwPath: string | null = null;

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
 * Returns the path to the embedded sfw script, or null if not found.
 * The sfw CLI is bundled with the app via webpack CopyPlugin.
 */
export function getSfwPath(): string | null {
  if (sfwPath !== null) return sfwPath;

  // Embedded sfw script copied by webpack CopyPlugin.
  // Mirrors the original node_modules/sfw/ layout (dist/sfw.mjs + package.json)
  // because sfw.mjs reads "../package.json" at runtime for its version.
  // In a packaged app the sfw directory is asar-unpacked (see forge.config.ts)
  // so system Node can read it — translate the virtual asar path accordingly.
  const embeddedPath = path
    .resolve(__dirname, '../sfw/dist/sfw.mjs')
    .replace(
      `${path.sep}app.asar${path.sep}`,
      `${path.sep}app.asar.unpacked${path.sep}`,
    );
  if (fs.existsSync(embeddedPath)) {
    sfwPath = embeddedPath;
    return sfwPath;
  }

  sfwPath = '';
  return null;
}

/**
 * Checks if sfw (Socket Firewall) is available (embedded with the app).
 */
export function getIsSfwInstalled(): boolean {
  return getSfwPath() !== null;
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
    const sfwScript = getSfwPath();
    if (sfwScript) {
      // Run the embedded sfw script via system node: node sfw.mjs npm install ...
      return await execFile(dir, 'node', [sfwScript, pm, ...pmArgs]);
    }
    console.warn('Socket Firewall requested but sfw script was not found');
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
