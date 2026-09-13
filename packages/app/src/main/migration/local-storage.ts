/**
 * Reads the previous Electron Fiddle's localStorage for the one-time import
 * (REQUIREMENTS §6). The old app kept its settings in the `file://` origin's
 * localStorage, in the default session of this same userData folder.
 *
 * This is the only `file://` load the app ever makes (see security.ts): a
 * hidden, sandboxed window with no preload and no IPC loads the blank page
 * shipped in `static/import-local-storage.html`, the values are read with
 * `executeJavaScript`, and the window is destroyed.
 */
import fs from 'node:fs';
import path from 'node:path';

import { app, BrowserWindow } from 'electron';

/** The app's `static/` folder, as main/documents/service.ts `staticDir()` finds it. */
function blankPage(): string {
  const dir = app.isPackaged
    ? path.join(process.resourcesPath, 'static')
    : path.join(app.getAppPath(), 'static');
  return path.join(dir, 'import-local-storage.html');
}

const READ_ALL = `JSON.stringify(Object.fromEntries(
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    .map((key) => [key, localStorage.getItem(key)]),
))`;

/** Keeps string values only. */
function parseStorageDump(json: unknown): Record<string, string> {
  const data: unknown = typeof json === 'string' ? JSON.parse(json) : undefined;
  const out: Record<string, string> = {};
  if (typeof data !== 'object' || data === null) return out;
  for (const [key, value] of Object.entries(data)) if (typeof value === 'string') out[key] = value;
  return out;
}

/** The old app's localStorage, or undefined when this profile has none. */
export async function readOldLocalStorage(userData: string): Promise<Record<string, string> | undefined> {
  if (!fs.existsSync(path.join(userData, 'Local Storage'))) return undefined;
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  const contents = win.webContents;
  contents.on('will-navigate', (event) => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  try {
    await win.loadFile(blankPage());
    return parseStorageDump(await contents.executeJavaScript(READ_ALL));
  } finally {
    win.destroy();
  }
}
