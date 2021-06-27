import { EditorValues, MAIN_JS } from '../interfaces';
import { isSupportedFile } from './editor-utils';

import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Reads a Fiddle from a directory.
 *
 * @param {string} filePath
 * @returns {EditorValues} the loaded Fiddle
 */
export function readFiddle(folder: string): EditorValues {
  const got: EditorValues = {};

  const tryRead = (name: string) => {
    try {
      const filename = path.join(folder, name);
      const content = fs.readFileSync(filename, 'utf-8');
      return content || '';
    } catch (error) {
      console.warn(`Could not read file ${name}:`, error);
      return '';
    }
  };

  if (!fs.existsSync(folder)) {
    console.warn(`readFiddle(): "${folder}" does not exist`);
  } else {
    for (const file of fs.readdirSync(folder)) {
      if (isSupportedFile(file)) {
        got[file] = tryRead(file);
      }
    }
  }

  if (!(MAIN_JS in got)) {
    got[MAIN_JS] = '';
  }

  console.log(`Got Fiddle from "${folder}". Found:`, Object.keys(got).sort());
  return got;
}
