import * as path from 'path';

import { EditorId, EditorValues, MAIN_JS } from '../interfaces';

// The order of these fields is the order that
// they'll be sorted in the mosaic
const KNOWN_FILES: string[] = [
  MAIN_JS,
  'renderer.js',
  'index.html',
  'preload.js',
  'styles.css',
];

export function isKnownFile(filename: string): boolean {
  return KNOWN_FILES.includes(filename);
}

const TITLE_MAP = new Map<EditorId, string>([
  [MAIN_JS, `Main Process (${MAIN_JS})`],
  ['renderer.js', 'Renderer Process (renderer.js)'],
  ['index.html', 'HTML (index.html)'],
  ['preload.js', 'Preload (preload.js)'],
  ['styles.css', 'Stylesheet (styles.css)'],
]);

export function getEditorTitle(id: EditorId): string {
  return TITLE_MAP.get(id) || id;
}

const EMPTY_EDITOR_CONTENT = {
  css: '/* Empty */',
  html: '<!-- Empty -->',
  js: '// Empty',
} as const;

function getSuffix(filename: string) {
  return path.parse(filename).ext.slice(1);
}

export function getEmptyContent(filename: string): string {
  return EMPTY_EDITOR_CONTENT[getSuffix(filename)] || '';
}

export function isSupportedFile(filename: string): boolean {
  return /\.(css|html|js)$/i.test(filename);
}

// the KNOWN_FILES, in the order of that array, go first.
// then everything else, sorted lexigraphically
export function compareEditors(a: EditorId, b: EditorId) {
  const ia = KNOWN_FILES.indexOf(a as any);
  const ib = KNOWN_FILES.indexOf(b as any);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export function monacoLanguage(filename: string) {
  const suffix = getSuffix(filename);
  if (suffix === 'css') return 'css';
  if (suffix === 'html') return 'html';
  return 'javascript';
}

const requiredFiles = new Set<EditorId>([MAIN_JS]);

export function isRequiredFile(id: EditorId) {
  return requiredFiles.has(id);
}

export function ensureRequiredFiles(values: EditorValues): EditorValues {
  for (const file of requiredFiles) {
    values[file] ||= getEmptyContent(file);
  }
  return values;
}
