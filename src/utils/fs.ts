import * as fsType from 'fs-extra';

let _fs: typeof fsType | null = null;

/**
 * Returns a loaded Octokit.
 *
 * @export
 * @returns {Promise<typeof fsType>}
 */
export async function getFs(): Promise<typeof fsType> {
  return _fs = _fs || await import('fs-extra');
}

