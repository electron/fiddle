import { EditorId, MAIN_CJS, MAIN_JS, MAIN_MJS } from '../../interfaces';
import {
  ensureRequiredFiles,
  getEmptyContent,
  getSuffix,
  isMainEntryPoint,
  isSupportedFile,
} from '../../utils/editor-utils';

export {
  ensureRequiredFiles,
  getEmptyContent,
  getSuffix,
  isMainEntryPoint,
  isSupportedFile,
};

// The order of these fields is the order that
// they'll be sorted in the mosaic
const KNOWN_FILES: string[] = [
  MAIN_CJS,
  MAIN_JS,
  MAIN_MJS,
  'renderer.cjs',
  'renderer.js',
  'renderer.mjs',
  'index.html',
  'preload.cjs',
  'preload.js',
  'preload.mjs',
  'styles.css',
];

export function isKnownFile(filename: string): boolean {
  return KNOWN_FILES.includes(filename);
}

export function getEditorTitle(id: EditorId): string {
  switch (id) {
    case 'index.html':
      return 'HTML (index.html)';

    case MAIN_CJS:
    case MAIN_JS:
    case MAIN_MJS:
      return `Main Process (${id})`;

    case 'preload.cjs':
    case 'preload.js':
    case 'preload.mjs':
      return `Preload (${id})`;

    case 'renderer.cjs':
    case 'renderer.js':
    case 'renderer.mjs':
      return `Renderer Process (${id})`;

    case 'styles.css':
      return 'Stylesheet (styles.css)';
  }

  return id;
}

// the KNOWN_FILES, in the order of that array, go first.
// then everything else, sorted lexigraphically
export function compareEditors(a: EditorId, b: EditorId) {
  const ia = KNOWN_FILES.indexOf(a);
  const ib = KNOWN_FILES.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export function monacoLanguage(filename: string) {
  const suffix = getSuffix(filename);
  if (suffix === 'css') return 'css';
  if (suffix === 'html') return 'html';
  if (suffix === 'json') return 'json';
  return 'javascript';
}
