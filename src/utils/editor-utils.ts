import * as path from 'path';
import { EditorId, MAIN_JS } from '../interfaces';

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

const TITLE_MAP: Record<EditorId, string> = Object.freeze({
  [MAIN_JS]: `Main Process (${MAIN_JS})`,
  'renderer.js': 'Renderer Process (renderer.js)',
  'index.html': 'HTML (index.html)',
  'preload.js': 'Preload (preload.js)',
  'styles.css': 'Stylesheet (styles.css)',
});

export function getEditorTitle(id: EditorId): string {
  return TITLE_MAP[id] || `Custom Editor (${id})`;
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

// first go the defaults, in the order they appear in DEFAULT_EDITORS
// then customs, sorted lexicographically
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
