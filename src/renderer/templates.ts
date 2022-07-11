import * as path from 'path';
import { EditorValues } from '../interfaces';
import { readFiddle } from '../utils/read-fiddle';

// Defined in webpack plugins.
declare const STATIC_DIR: string;
/**
 * Returns expected content for a given name.
 *
 * @param {string} name
 * @returns {Promise<EditorValues>}
 */
export function getTemplateValues(name: string): Promise<EditorValues> {
  const templatePath = path.join(STATIC_DIR, 'show-me', name.toLowerCase());

  return readFiddle(templatePath);
}
