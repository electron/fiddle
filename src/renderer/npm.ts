import { EditorValues } from '../interfaces';
import { exec } from '../utils/exec';
import { fancyImport } from '../utils/import';

export interface NpmOperationOptions {
  dir: string;
}

export let isInstalled: boolean | null = null;

const modulesToIgnore = [
  'electron'
]
const requiregx:RegExp = /require\(['"](.*?)['"]\)/gm;

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
export async function findModulesInEditors(values: EditorValues): Promise<Array<string>> {
  const files = [values.main, values.renderer];
  const modules: Array<string> = [];

  for (const file of files) {
    const fileModules = await findModules(file);
    modules.push(...fileModules);
  }

  return modules;
}

/**
 * Uses a simple regex to find `require()` statements in a string.
 * Tries to exclude electron and Node built-ins as well as file-path
 * references.
 *
 * @param {string} input
 * @returns {Array<string>}
 */
export async function findModules(input: string): Promise<Array<string>> {
  const builtinList = (await fancyImport('builtin-modules') as any).default
  const ignoredList:Array<string> = [...builtinList, ...modulesToIgnore]
  const isNotIgnored = (str: string) => !ignoredList.includes(str) && !str.startsWith('.')
  const modules = []
  let match
  while((match = requiregx.exec(input)) !== null) {
    modules.push(match)
  }
  console.log('modules found:')
  console.dir(modules)
  const result = modules
  .map(mod => mod[1])
  .map(mod =>
    mod.includes('/') && !mod.startsWith('@') ?
    mod.split('/')[0] :
    mod
  )
  .filter(isNotIgnored)
  .filter((m,idx,arr) => arr.lastIndexOf(m) === idx)
  console.log('results found:')
  console.dir(result)

  return result
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
