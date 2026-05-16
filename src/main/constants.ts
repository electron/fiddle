import * as path from 'node:path';

import { app } from 'electron';

// Find the root dir for static assets (eg `show-me/`, `electron-quick-start/`).
// In production, the bundled main script lives in `.webpack/main/` and webpack
// copies static assets to `.webpack/static/`.
// In tests (vitest loads the source TypeScript directly), `__dirname` is
// `src/main/` and the static folder lives at the repository root.
export const STATIC_DIR = path.resolve(
  __dirname,
  process.env.VITEST ? '../../static' : '../static',
);

export const ELECTRON_DOWNLOAD_PATH = path.join(
  app.getPath('userData'),
  'electron-bin',
);
export const ELECTRON_INSTALL_PATH = path.join(
  ELECTRON_DOWNLOAD_PATH,
  'current',
);
