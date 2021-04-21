// Singleton: We don't want to do this more than once
let _shellPathCalled = false;

/**
 * Execute a command in a directory.
 *
 * @param {string} dir
 * @param {string} cliArgs
 * @returns {Promise<string>}
 */
export async function exec(dir: string, cliArgs: string): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    await maybeFixPath();

    const { exec: cpExec } = await import('child_process');

    cpExec(
      cliArgs,
      {
        cwd: dir,
        maxBuffer: 200 * 1024 * 100, // 100 times the default
      },
      (error, result) => {
        if (error) {
          reject(error);
        }

        resolve(typeof result === 'string' ? result : `${result}`);
      },
    );
  });
}

/**
 * On macOS & Linux, we need to fix the $PATH environment variable
 * so that we can call `npm`.
 *
 * @returns {Promise<void>}
 */
export async function maybeFixPath(): Promise<void> {
  if (!_shellPathCalled && process.platform !== 'win32') {
    const shellPaths = require('shell-path');
    const paths = await shellPaths();
    if (paths) {
      process.env.PATH = paths;
    }
  }

  _shellPathCalled = true;
}
