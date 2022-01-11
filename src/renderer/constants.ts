import * as path from 'path';

export const USER_DATA_PATH = window.ElectronFiddle.appPaths.userData;
export const CONFIG_PATH = path.join(
  window.ElectronFiddle.appPaths.home,
  '.electron-fiddle',
);

export const ELECTRON_ORG = 'electron';
export const ELECTRON_REPO = 'electron';
