import * as path from 'path';

import * as fs from 'fs-extra';

import { EditorValues, PACKAGE_NAME } from '../interfaces';
import { ensureRequiredFiles, isSupportedFile } from './editor-utils';

/**
 * Reads a Fiddle from a directory.
 *
 * @param {string} folder
 * @param {boolean} includePackageJson
 * @returns {Promise<EditorValues>} the loaded Fiddle
 */
export async function readFiddle(
  folder: string,
  includePackageJson = false,
): Promise<EditorValues> {
  let got: EditorValues = {};

  try {
    // TODO(dsanders11): Remove options once issue fixed:
    // https://github.com/isaacs/node-graceful-fs/issues/223
    const files = await fs.readdir(folder, { encoding: 'utf8' });
    const names = files.filter(
      (f) => isSupportedFile(f) || (includePackageJson && f === PACKAGE_NAME),
    );

    const values = await Promise.allSettled(
      names.map((name) => fs.readFile(path.join(folder, name), 'utf8')),
    );

    for (let i = 0; i < names.length; ++i) {
      const name = names[i];
      const value = values[i];

      if (value.status === 'fulfilled') {
        got[name] = value.value || '';
      } else {
        console.warn(`Could not read file ${name}:`, value.reason);
        got[name] = '';
      }
    }
  } catch (err) {
    console.warn(`Unable to read "${folder}": ${err.toString()}`);
  }

  got = ensureRequiredFiles(got);
  console.log(`Got Fiddle from "${folder}". Found:`, Object.keys(got).sort());
  return got;
}
