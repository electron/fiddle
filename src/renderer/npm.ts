import { EditorValues } from '../interfaces';
import { exec } from '../utils/exec';

export interface NpmOperationOptions {
  dir: string;
}

export let isInstalled: boolean | null = null;

/* add other modules to automatically ignore here */
/* perhaps we can expose this to the settings module?*/
const ignoredModules: Array<string> = [
  'electron',
  // tslint:disable-next-line:no-submodule-imports
  ...require('builtin-modules/static')
];

/* regular expression to both match and extract module names */
const requiregx = /^.*require\(['"](.*?)['"]\)/gm;


/*
 Quick and dirty filter functions for filtering module names
*/
const isIgnored = (str: string): boolean => ignoredModules.includes(str);
const isLocalModule = (str: string): boolean => (/^[,/~\.]/.test(str));
const isUnique = (item: any, idx: number, arr: Array<any>): boolean => {
  return arr.lastIndexOf(item) === idx;
};


/**
 * Checks if npm is installed by checking if a binary
 * with that name can be found.
 */
export async function getIsNpmInstalled(ignoreCache?: boolean): Promise<boolean> {
  if (isInstalled !== null && !ignoreCache) return isInstalled;

  const command = process.platform === 'win32'
    ? 'where.exe npm'
    : 'which npm';

  try {
    await exec(process.cwd(), command);
    return isInstalled = true;
  } catch (error) {
    console.warn(`getIsNpmInstalled: "${command}" failed.`, error);
    return isInstalled = false;
  }
}

/**
 * Finds npm modules in editor values, returning an array of modules.
 *
 * @param {EditorValues} values
 * @returns {Array<string>}
 */
export function findModulesInEditors(values: EditorValues) {
  const files = [ values.main, values.renderer ];
  const modules = files.reduce(
    (agg, file) => [
      ...agg,
      ...findModules(file)
    ],
    []
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
  // tslint:disable-next-line:no-conditional-assignment
  while (match = (requiregx.exec(input) || null)) {
    // ensure commented-out requires aren't downloaded
    if (!match[0].startsWith('//')) {
      const mod = match[1];
      modules.push(mod);
    }
  }

  /* map and reduce */
  return modules
    .map((mod) =>
      mod.includes('/') && !mod.startsWith('@') ?
      mod.split('/')[0] :
      mod
    )
    .filter((m) => !isIgnored(m))
    .filter((m) => !isLocalModule(m))
    .filter(isUnique);
}

/**
 * Installs given modules to a given folder.
 *
 * @param {NpmOperationOptions} { dir }
 * @param {...Array<string>} names
 * @returns {Promise<string>}
 */
export async function installModules({ dir }: NpmOperationOptions, ...names: Array<string>): Promise<string> {
  const nameArgs = names.length > 0
    ? [ '-S', ...names ]
    : ['--dev --prod'];

  return exec(dir, [ `npm install` ].concat(nameArgs).join(' '));
}

/**
 * Execute an "npm run" command
 *
 * @param {NpmOperationOptions} { dir }
 * @param {string} command
 * @returns {Promise<string>}
 */
export function npmRun({ dir }: NpmOperationOptions, command: string): Promise<string> {
  return exec(dir, `npm run ${command}`);
}
