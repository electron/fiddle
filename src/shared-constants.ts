import { EditorId } from './interfaces';

export const INDEX_HTML_NAME = 'index.html';
export const MAIN_JS_NAME = 'main.js';
export const RENDERER_JS_NAME = 'renderer.js';
export const PRELOAD_JS_NAME = 'preload.js';
export const STYLES_CSS_NAME = 'styles.css';
export const PACKAGE_NAME = 'package.json';

export const FILENAME_KEYS = Object.freeze({
  [INDEX_HTML_NAME]: EditorId.html,
  [MAIN_JS_NAME]: EditorId.main,
  [PRELOAD_JS_NAME]: EditorId.preload,
  [RENDERER_JS_NAME]: EditorId.renderer,
  [STYLES_CSS_NAME]: EditorId.css,
});
