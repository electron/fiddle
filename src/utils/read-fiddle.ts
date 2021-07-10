import { EditorValues } from '../interfaces';
import { ensureRequiredFiles, isSupportedFile } from './editor-utils';

import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Reads a Fiddle from a directory.
 *
 * @param {string} filePath
 * @returns {Promise<EditorValues>} the loaded Fiddle
 */
export async function readFiddle(folder: string): Promise<EditorValues> {
  let got: EditorValues = {};

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

  got = ensureRequiredFiles(got);
  console.log(`Got Fiddle from "${folder}". Found:`, Object.keys(got).sort());
  return got;
}
