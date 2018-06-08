import { remote } from 'electron';

export const USER_DATA_PATH = remote.app.getPath('userData');
export const INDEX_HTML_NAME = 'index.html';
export const MAIN_JS_NAME = 'main.js';
export const RENDERER_JS_NAME = 'renderer.js';
