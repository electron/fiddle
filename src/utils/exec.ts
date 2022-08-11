import { exec as cp_exec } from 'child_process';
import { promisify } from 'util';

import shellEnv from 'shell-env';

/**
 * On macOS & Linux, we need to fix the $PATH environment variable
 * so that we can call `npm`.
 *
 * @returns {Promise<void>}
 */
export const maybeFixPath = (() => {
  // Singleton: We don't want to do this more than once.
  let _shellPathCalled = false;

  return async (): Promise<void> => {
    if (_shellPathCalled) {
      return;
    }

    if (process.platform !== 'win32') {
      const { PATH } = await shellEnv();
      if (PATH) {
        process.env.PATH = PATH;
      }
    }

    _shellPathCalled = true;
  };
})();

/**
 * Execute a command in a directory.
 *
 * @param {string} dir
 * @param {string} cliArgs
 * @returns {Promise<string>}
 */
export async function exec(dir: string, cliArgs: string): Promise<string> {
  await maybeFixPath();

  const { stdout } = await promisify(cp_exec)(cliArgs, {
    cwd: dir,
    maxBuffer: 200 * 1024 * 100, // 100 times the default
  });

  return stdout.trim();
}
