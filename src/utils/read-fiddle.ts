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
 * Safely attempts to read a file, doesn't crash the app if
 * it fails.
 *
 * @param {string} filePath
 * @returns {string}
 */
async function readFile(
  filePath: string
): Promise<string> {
  try {
    const fs = await fancyImport<typeof fsType>('fs-extra');
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.log(`Could not read ${filePath}`, error);
    return '';
  }
}

/**
 * Reads a Fiddle from a directory.
 *
 * @param {string} filePath
 * @returns {Promise<EditorValues>} the loaded Fiddle
 */
export async function readFiddle(
  filePath: string
): Promise<EditorValues> {
   const editorValues: EditorValues = {
      html: await readFile(path.join(filePath, INDEX_HTML_NAME)),
      main: await readFile(path.join(filePath, MAIN_JS_NAME)),
      renderer: await readFile(path.join(filePath, RENDERER_JS_NAME)),
      preload: await readFile(path.join(filePath, PRELOAD_JS_NAME)),
      css: await readFile(path.join(filePath, STYLES_CSS_NAME)),
    };
    return editorValues;
}
