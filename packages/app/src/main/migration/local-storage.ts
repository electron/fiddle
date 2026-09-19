/**
 * The old app kept its settings in the `file://` origin's localStorage. This is
 * the only `file://` load the app makes: a hidden, sandboxed window without
 * preload or IPC.
 */
import fs from 'node:fs';
import path from 'node:path';

import { app, BrowserWindow } from 'electron';

/** In the same `static/` folder as `staticDir()` in documents/service.ts. */
function blankPage(): string {
  const dir = app.isPackaged
    ? path.join(process.resourcesPath, 'static')
    : path.join(app.getAppPath(), 'static');
  return path.join(dir, 'import-local-storage.html');
}

/** A hidden window that never answers must not hold up startup. */
const READ_TIMEOUT_MS = 10_000;

const READ_ALL = `JSON.stringify(Object.fromEntries(
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    .map((key) => [key, localStorage.getItem(key)]),
))`;

/** Keeps string values only. */
function parseStorageDump(json: unknown): Record<string, string> {
  const data: unknown = typeof json === 'string' ? JSON.parse(json) : undefined;
  const out: Record<string, string> = {};
  if (typeof data !== 'object' || data === null) return out;
  for (const [key, value] of Object.entries(data))
    if (typeof value === 'string') out[key] = value;
  return out;
}

/** The old app's localStorage, or undefined when this profile has none. */
export async function readOldLocalStorage(
  userData: string,
): Promise<Record<string, string> | undefined> {
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
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('reading the old localStorage timed out')),
      READ_TIMEOUT_MS,
    );
  });
  try {
    const read = win
      .loadFile(blankPage())
      .then(() => contents.executeJavaScript(READ_ALL));
    return parseStorageDump(await Promise.race([read, timeout]));
  } finally {
    clearTimeout(timer);
    win.destroy();
  }
}
