import * as electronModule from 'electron';

const electron = electronModule.remote
  ? electronModule.remote
  : electronModule;

export const USER_DATA_PATH = electron.app.getPath('userData');
export const INDEX_HTML_NAME = 'index.html';
export const MAIN_JS_NAME = 'main.js';
export const RENDERER_JS_NAME = 'renderer.js';
export const PACKAGE_NAME = 'package.json';
export const UNTITLED_NAME = 'untitled-fiddle';

