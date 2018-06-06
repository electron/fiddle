import * as fs from 'fs';
import * as path from 'path';

const simpleCache = {};

export function getContent(name) {
  if (simpleCache[name]) return simpleCache[name];

  const filePath = path.join(__dirname, '../../static/content', name);
  const content = fs.readFileSync(filePath, 'utf-8');

  simpleCache[name] = content;

  return content;
}
