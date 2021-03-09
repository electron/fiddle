import * as pathType from 'path';
import { EditorValues } from '../interfaces';
import { fancyImport } from '../utils/import';
import { readFiddle } from '../utils/read-fiddle';

/**
 * Returns expected content for a given name.
 *
 * @param {string} name
 * @returns {Promise<EditorValues>}
 */
export async function getTemplateValues(name: string): Promise<EditorValues> {
  const path = await fancyImport<typeof pathType>('path');
  const folder = path.join(__dirname, '../../static/show-me', name.toLowerCase());
  return readFiddle(folder, true);
}
