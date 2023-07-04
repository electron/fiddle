import * as path from 'node:path';

export const USER_DATA_PATH = window.ElectronFiddle.appPaths.userData;
export const ELECTRON_DOWNLOAD_PATH = path.join(USER_DATA_PATH, 'electron-bin');
export const ELECTRON_INSTALL_PATH = path.join(
  ELECTRON_DOWNLOAD_PATH,
  'current',
);

export const ELECTRON_ORG = 'electron';
export const ELECTRON_REPO = 'electron';

export const FIDDLE_GIST_DESCRIPTION_PLACEHOLDER = 'Electron Fiddle Gist';
