import * as path from 'path';
import { EditorValues } from '../interfaces';
import { readFiddle } from '../utils/read-fiddle';

/**
 * Returns expected content for a given name.
 *
 * @param {string} name
 * @returns {Promise<EditorValues>}
 */
export function getTemplateValues(name: string): Promise<EditorValues> {
  const folder = path.join(
    __dirname,
    '../../static/show-me',
    name.toLowerCase(),
  );
  return readFiddle(folder);
}
