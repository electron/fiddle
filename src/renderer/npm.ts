import { exec } from '../utils/exec';

export type IPackageManager = 'npm' | 'yarn';

export interface PMOperationOptions {
  dir: string;
  packageManager: IPackageManager;
}

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
 *
 * @param {PMOperationOptions} { dir, packageManager }
 * @param {...Array<string>} names
 * @returns {Promise<string>}
 */
export async function addModules(
  { dir, packageManager }: PMOperationOptions,
  ...names: Array<string>
): Promise<string> {
  let nameArgs: Array<string> = [];

  if (packageManager === 'npm') {
    nameArgs = names.length > 0 ? ['-S', ...names] : ['--also=dev --prod'];
  } else {
    nameArgs = [...names];
  }

  const installCommand = packageManager === 'npm' ? 'npm install' : 'yarn add';

  return exec(dir, [installCommand].concat(nameArgs).join(' '));
}

/**
 * Execute an "{packageManager} run" command
 *
 * @param {PMOperationOptions} { dir, packageManager }
 * @param {string} command
 * @returns {Promise<string>}
 */
export function packageRun(
  { dir, packageManager }: PMOperationOptions,
  command: string,
): Promise<string> {
  return exec(dir, `${packageManager} run ${command}`);
}
