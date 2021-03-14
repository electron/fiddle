import { EditorValues } from '../interfaces';
import {
  INDEX_HTML_NAME,
  MAIN_JS_NAME,
  PRELOAD_JS_NAME,
  RENDERER_JS_NAME,
  STYLES_CSS_NAME,
} from '../shared-constants';

import * as fs from 'fs-extra';
import * as path from 'path';

const FILENAME_KEYS = Object.freeze({
  [INDEX_HTML_NAME]: 'html',
  [MAIN_JS_NAME]: 'main',
  [PRELOAD_JS_NAME]: 'preload',
  [RENDERER_JS_NAME]: 'renderer',
  [STYLES_CSS_NAME]: 'css',
});

/**
 * Reads a Fiddle from a directory.
 *
 * @param {string} filePath
 * @returns {Promise<EditorValues>} the loaded Fiddle
 */
export async function readFiddle(folder: string): Promise<EditorValues> {
  const ret: EditorValues = {
    css: '',
    html: '',
    main: '',
    preload: '',
    renderer: '',
  };

  const hits: string[] = [];
  const misses = new Set(Object.keys(FILENAME_KEYS));

  const tryRead = (basename: string) => {
    try {
      const filename = path.join(folder, basename);
      const content = fs.readFileSync(filename, 'utf-8');
      hits.push(basename);
      misses.delete(basename);
      return content || '';
    } catch (error) {
      console.warn(`Could not read template file ${basename}:`, error);
      return '';
    }
  };

  if (!fs.existsSync(folder)) {
    console.warn(`readFiddle(): "${folder}" does not exist`);
  } else {
    for (const file of fs.readdirSync(folder)) {
      const key = FILENAME_KEYS[file];
      if (key) {
        ret[key] = tryRead(file);
      }
    }
  }

  console.log(`Got Fiddle from "${folder}".
Found: ${hits.sort().join(', ')}
Missed: ${[...misses].sort().join(', ')}`);

  return ret;
}
