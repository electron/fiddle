// Singleton: We don't want to do this more than once
let _fixPathCalled = false;

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

    cpExec(cliArgs, {
      cwd: dir,
      maxBuffer: 200 * 1024 * 100 // 100 times the default
    }, (error, result) => {
      if (error) {
        reject(error);
      }

      resolve(typeof result === 'string' ? result : `${result}`);
    });
  });
}

/**
 * On macOS, we need to fix the $PATH environment variable
 * so that we can call `npm`.
 *
 * @returns {Promise<void>}
 */
export async function maybeFixPath(): Promise<void> {
  if (!_fixPathCalled && process.platform !== 'win32') {
    const fixPaths = require('fix-path');
    fixPaths();
  }

  _fixPathCalled = true;
}
