import { EditorId, MAIN_JS } from '../../interfaces';
import {
  ensureRequiredFiles,
  getEmptyContent,
  getSuffix,
  isRequiredFile,
  isSupportedFile,
} from '../../utils/editor-utils';

export {
  ensureRequiredFiles,
  getEmptyContent,
  getSuffix,
  isRequiredFile,
  isSupportedFile,
};

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
