import { DefaultEditorId, EditorValues } from '../interfaces';
import { isKnownFile, isSupportedFile } from './editor-utils';

import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Reads a Fiddle from a directory.
 *
 * @param {string} filePath
 * @returns {Promise<EditorValues>} the loaded Fiddle
 */
export async function readFiddle(folder: string): Promise<EditorValues> {
  const customMosaics: Record<string, string> = {};
  const defaultMosaics: EditorValues = {
    [DefaultEditorId.css]: '',
    [DefaultEditorId.html]: '',
    [DefaultEditorId.main]: '',
    [DefaultEditorId.preload]: '',
    [DefaultEditorId.renderer]: '',
  };

  const hits: string[] = [];
  const misses = new Set(Object.values(DefaultEditorId));

  const tryRead = (name: string) => {
    try {
      const filename = path.join(folder, name);
      const content = fs.readFileSync(filename, 'utf-8');
      hits.push(name);
      misses.delete(name as DefaultEditorId);
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
      if (isKnownFile(file)) {
        defaultMosaics[file] = tryRead(file);
      } else if (isSupportedFile(file)) {
        customMosaics[file] = tryRead(file);
      }
    }
  }

  console.log(`Got Fiddle from "${folder}".
Found Default Mosaics: ${hits.sort().join(', ')}
Found Custom Mosaics: ${Object.keys(customMosaics).sort().join(', ')}
Missed: ${[...misses].sort().join(', ')}`);

  return { ...defaultMosaics, ...customMosaics };
}
