import { EditorValues } from '../interfaces';
import { exec } from '../utils/exec';
import stripComments from 'strip-comments';

// Making TypeScript happy and avoiding "esModuleInterop" issues
const { builtinModules } = require('module');

export type IPackageManager = 'npm' | 'yarn';

export interface PMOperationOptions {
  dir: string;
  packageManager: IPackageManager;
}

let isNpmInstalled: boolean | null = null;
let isYarnInstalled: boolean | null = null;

/* add other modules to automatically ignore here */
/* perhaps we can expose this to the settings module?*/
const ignoredModules: Array<string> = [
  'electron',
  'original-fs',
  ...builtinModules,
];

/* regular expression to both match and extract module names */
const requiregx = /require\(['"](.*?)['"]\)/gm;

/*
 Quick and dirty filter functions for filtering module names
*/
const isIgnored = (str: string): boolean => ignoredModules.includes(str);
const isLocalModule = (str: string): boolean => /^[,/~\.]/.test(str);
const isUnique = (item: any, idx: number, arr: Array<any>): boolean => {
  return arr.lastIndexOf(item) === idx;
};

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
 * Finds npm modules in editor values, returning an array of modules.
 */
export async function findModulesInEditors(values: EditorValues) {
  const modules: Array<string> = [];

  // Filter out all editor values which aren't JavaScript files.
  const contents = Object.entries(values)
    .filter(([filename]) => filename.endsWith('.js'))
    .map(([_, content]) => content) as string[];

  for (const content of contents) {
    const found = await findModules(content);
    modules.push(...found);
  }

  console.log('Modules Found:', modules);

  return Array.from(new Set(modules));
}

/**
 * Finds `require()` statements in a string.
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
export async function findModules(code: string) {
  /* container definitions */
  const modules: Array<string> = [];
  let match: RegExpMatchArray | null;

  code = stripComments(code);

  /* grab all global require matches in the text */
  while ((match = requiregx.exec(code) || null)) {
    const mod = match[1];
    modules.push(mod);
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
