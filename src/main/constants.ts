import * as path from 'node:path';

import { app } from 'electron';

export const STATIC_DIR = path.resolve(__dirname, '../static');

export const ELECTRON_DOWNLOAD_PATH = path.join(
  app.getPath('userData'),
  'electron-bin',
);
export const ELECTRON_INSTALL_PATH = path.join(
  ELECTRON_DOWNLOAD_PATH,
  'current',
);
