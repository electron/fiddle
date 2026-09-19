/** Skipped in dev and test mode, so a dev build never takes over the protocol. */
import fs from 'node:fs';

import { app } from 'electron';

import { log } from '../log';
import { isTestMode } from '../test-mode';
import { PROTOCOL, squirrelStubPath } from './squirrel';

export function registerProtocolClient(): void {
  if (!app.isPackaged || isTestMode()) return;
  try {
    if (process.platform === 'win32') {
      // MSIX declares the protocol in its manifest. Squirrel registers the stub, and
      // only if it exists, so a portable copy never takes the protocol over.
      if (process.windowsStore) return;
      const stub = squirrelStubPath();
      if (!fs.existsSync(stub)) return;
      if (!app.isDefaultProtocolClient(PROTOCOL, stub))
        app.setAsDefaultProtocolClient(PROTOCOL, stub);
      return;
    }
    if (!app.isDefaultProtocolClient(PROTOCOL)) app.setAsDefaultProtocolClient(PROTOCOL);
  } catch (error) {
    log.warn('registering the electron-fiddle:// protocol failed', error);
  }
}
