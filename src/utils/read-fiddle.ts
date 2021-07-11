import { EditorValues, MAIN_JS } from '../interfaces';
import { isSupportedFile } from './editor-utils';

import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Reads a Fiddle from a directory.
 *
 * @param {string} filePath
 * @returns {Promise<EditorValues>} the loaded Fiddle
 */
export async function readFiddle(folder: string): Promise<EditorValues> {
  const got: EditorValues = {};

  try {
    const names = (await fs.readdir(folder)).filter(isSupportedFile);
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

  if (!(MAIN_JS in got)) {
    got[MAIN_JS] = '';
  }

  console.log(`Got Fiddle from "${folder}". Found:`, Object.keys(got).sort());
  return got;
}
