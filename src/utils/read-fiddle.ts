import { fancyImport } from './import';
import { EditorValues } from '../interfaces';
import {
  INDEX_HTML_NAME,
  MAIN_JS_NAME,
  PRELOAD_JS_NAME,
  RENDERER_JS_NAME,
  STYLES_CSS_NAME,
} from '../shared-constants';

import * as fsType from 'fs-extra';
import * as path from 'path';

/**
 * Safely attempts to read a file.
 * Don't crash the app if reading fails.
 *
 * @param {string} filePath
 * @param {boolean} [logFolderOnError=false] More verbose error logging
 * @returns {string}
 */
async function readFile(
  filePath: string,
  logFolderOnError = false,
): Promise<string> {
  const fs = await fancyImport<typeof fsType>('fs-extra');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content ? content : '';
  } catch (error) {
    console.log(`Could not read template file:`, error);
    if (logFolderOnError) {
      const folder = path.dirname(filePath);
      if (fs.existsSync(folder)) {
        console.log(`readFiddle(): ${folder} contains`, fs.readdirSync(folder));
      } else {
        console.log(`readFiddle(): ${folder} does not exist`);
      }
    }
    return '';
  }
}

/**
 * Reads a Fiddle from a directory.
 *
 * @param {string} filePath
 * @param {boolean} [logFolderOnError=false] More verbose error logging
 * @returns {Promise<EditorValues>} the loaded Fiddle
 */
export async function readFiddle(
  filePath: string,
  logFolderOnError = false,
): Promise<EditorValues> {
  const read = (basename: string) =>
    readFile(path.join(filePath, basename), logFolderOnError);
  return {
    html: await read(INDEX_HTML_NAME),
    main: await read(MAIN_JS_NAME),
    renderer: await read(RENDERER_JS_NAME),
    preload: await read(PRELOAD_JS_NAME),
    css: await read(STYLES_CSS_NAME),
  };
}
