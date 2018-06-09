import * as fs from 'fs';
import * as path from 'path';

const simpleCache = {};

/**
 * Returns expected content for a given name. Currently synchronous,
 * but probably shouldn't be.
 *
 * @param {string} name
 * @returns {string}
 */
export function getContent(name: string): string {
  if (simpleCache[name]) return simpleCache[name];

  let content = '';

  try {
    const filePath = path.join(__dirname, '../../static/content', name);
    content = fs.readFileSync(filePath, 'utf-8');
    simpleCache[name] = content;
  } catch (error) {
    console.error(`Content: Could not read file content for ${name}`, error);
  }

  return content;
}
