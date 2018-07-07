import { EditorValues } from '../interfaces';

// Singleton: We don't want to do this more than once
let _fixPathCalled = false;

export interface InstallModulesOptions {
  dir: string;
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
  const matchRequire = /require\(['"]{1}([\w\d\/\-\_]*)['"]{1}\)/;
  const matched = input.match(matchRequire);
  const result: Array<string> = [];
  const builtinModules = (await import('builtin-modules') as any).default;

  if (matched && matched.length > 0) {
    const candidates = matched.slice(1);
    candidates.forEach((candidate) => {
      if (candidate === 'electron') return;
      if (builtinModules.indexOf(candidate) > -1) return;
      if (candidate.startsWith('.')) return;
      result.push(candidate);
    });
  }

  console.log(`findModules: Result`, result);

  return result;
}

/**
 * Installs given modules to a given folder.
 *
 * @param {InstallModulesOptions} { dir }
 * @param {...Array<string>} names
 * @returns {Promise<string>}
 */
export function installModules({ dir }: InstallModulesOptions, ...names: Array<string>): Promise<string> {
  return new Promise(async (resolve, reject) => {
    await maybeFixPath();

    const { exec } = await import('child_process');
    const args = ['-S'];
    const cliArgs = ['npm i'].concat(args, names).join(' ');

    exec(cliArgs, { cwd: dir }, (error, result) => {
      if (error) {
        reject(error);
      }

      resolve(result.toString());
    });
  });
}

/**
 * On macOS, we need to fix the $PATH environment variable
 * so that we can call `npm`.
 *
 * @returns {Promise<void>}
 */
async function maybeFixPath(): Promise<void> {
  if (!_fixPathCalled && process.platform === 'darwin') {
    const fixPaths = (await import('fix-path')).default;
    fixPaths();
  }

  _fixPathCalled = true;
}
