import * as path from 'path';

const { appPaths } = window.ElectronFiddle;
export const USER_DATA_PATH = appPaths.userData;
export const CONFIG_PATH = path.join(appPaths.home, '.electron-fiddle');

export const ELECTRON_ORG = 'electron';
export const ELECTRON_REPO = 'electron';
