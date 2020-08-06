import { EditorValues } from '../interfaces';
import { exec } from '../utils/exec';

const { builtinModules } = require('module');

export type IPackageManager = 'npm' | 'yarn';

export interface PMOperationOptions {
  dir: string;
  packageManager: IPackageManager;
}

export let isNpmInstalled: boolean | null = null;
export let isYarnInstalled: boolean | null = null;

/* add other modules to automatically ignore here */
/* perhaps we can expose this to the settings module?*/
const ignoredModules: Array<string> = [
  'electron',
  'original-fs',
  ...builtinModules,
];

/* regular expression to both match and extract module names */
const requiregx = /^.*require\(['"](.*?)['"]\)/gm;

/*
 Quick and dirty filter functions for filtering module names
*/
const isIgnored = (str: string): boolean => ignoredModules.includes(str);
const isLocalModule = (str: string): boolean => /^[,/~\.]/.test(str);
const isUnique = (item: any, idx: number, arr: Array<any>): boolean => {
  return arr.lastIndexOf(item) === idx;
};

/**
 * Checks if yarn is installed by checking if a binary
 * with that name can be found.
 */
export async function getIsYarnInstalled(
  ignoreCache?: boolean,
): Promise<boolean> {
  if (isYarnInstalled !== null && !ignoreCache) return isYarnInstalled;

  const command =
    process.platform === 'win32' ? 'where.exe yarn' : 'which yarn';

  try {
    await exec(process.cwd(), command);
    return (isYarnInstalled = true);
  } catch (error) {
    console.warn(`getIsYarnInstalled: "${command}" failed.`, error);
    return (isYarnInstalled = false);
  }
}

/**
 * Checks if npm is installed by checking if a binary
 * with that name can be found.
 */
export async function getIsNpmInstalled(
  ignoreCache?: boolean,
): Promise<boolean> {
  if (isNpmInstalled !== null && !ignoreCache) return isNpmInstalled;

  const command = process.platform === 'win32' ? 'where.exe npm' : 'which npm';

  try {
    await exec(process.cwd(), command);
    return (isNpmInstalled = true);
  } catch (error) {
    console.warn(`getIsNpmInstalled: "${command}" failed.`, error);
    return (isNpmInstalled = false);
  }
}

/**
 * Finds npm modules in editor values, returning an array of modules.
 *
 * @param {EditorValues} values
 * @returns {Array<string>}
 */
export function findModulesInEditors(values: EditorValues) {
  const files = [values.main, values.renderer];
  const modules = files.reduce(
    (agg, file) => [...agg, ...findModules(file)],
    [],
  );

  console.log('Modules Found:', modules);

  return modules;
}

/**
 * Uses a simple regex to find `require()` statements in a string.
 * Tries to exclude electron and Node built-ins as well as file-path
 * references. Also will try to install base packages of modules
 * that have a slash in them, for example: `lodash/fp` as the actual package
 * is just `lodash`.
 *
 * However, it WILL try to add packages that are part of a huge
 * monorepo that are named `@<group>/<package>`
 *
 * @param {string} input
 * @returns {Array<string>}
 */
export function findModules(input: string): Array<string> {
  /* container definitions */
  const modules: Array<string> = [];
  let match: RegExpMatchArray | null;

  /* grab all global require matches in the text */
  while ((match = requiregx.exec(input) || null)) {
    // ensure commented-out requires aren't downloaded
    if (!match[0].startsWith('//')) {
      const mod = match[1];
      modules.push(mod);
    }
  }

  /* map and reduce */
  return modules
    .map((mod) =>
      mod.includes('/') && !mod.startsWith('@') ? mod.split('/')[0] : mod,
    )
    .filter((m) => !isIgnored(m))
    .filter((m) => !isLocalModule(m))
    .filter(isUnique);
}

/**
 * Installs given modules to a given folder.
 *
 * @param {PMOperationOptions} { dir, packageManager }
 * @param {...Array<string>} names
 * @returns {Promise<string>}
 */
export async function installModules(
  { dir, packageManager }: PMOperationOptions,
  ...names: Array<string>
): Promise<string> {
  let nameArgs: Array<string> = [];

  if (packageManager === 'npm') {
    nameArgs = names.length > 0 ? ['-S', ...names] : ['--dev --prod'];
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
