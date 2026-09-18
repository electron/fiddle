/**
 * Registers the app as the `electron-fiddle://` handler:
 *
 * - macOS: declared in the bundle (forge.config.ts `protocols`); this makes
 *   sure it's the default handler.
 * - Linux: the deb/rpm desktop entry declares the MIME type; this sets it as
 *   the default.
 * - Windows (Squirrel): registered for the Squirrel stub, and only when the
 *   stub exists, so a portable copy never takes it over. MSIX declares the
 *   protocol in its manifest, so nothing is done there.
 *
 * Skipped in dev and test mode, so a dev build never takes over the protocol.
 */
import fs from 'node:fs';

import { app } from 'electron';

import { log } from '../log';
import { isTestMode } from '../test-mode';
import { PROTOCOL, squirrelStubPath } from './squirrel';

export function registerProtocolClient(): void {
  if (!app.isPackaged || isTestMode()) return;
  try {
    if (process.platform === 'win32') {
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
