/**
 * The Electron security checklist (REQUIREMENTS.md §4) for sessions and
 * webContents. Web preferences are set where windows are created (window.ts).
 *
 * `file://` is never loaded, with one exception: the one-time import
 * (src/main/migration/local-storage.ts) loads `static/import-local-storage.html`
 * once, on the first launch, to read the previous app's file:// localStorage.
 * It runs before the handlers below are installed, so that window locks itself
 * down: hidden, sandboxed, no preload and no IPC, navigation and new windows
 * blocked, a `default-src 'none'` CSP, and it's destroyed right after reading.
 */
import { app, BrowserWindow, session, shell, type WebContents } from 'electron';

import { messageBox } from './dialogs';
import { t } from './i18n';
import { log } from './log';

/** Permissions are denied by default. Grants are added here one by one, with a reason. */
export function applySessionSecurity(ses = session.defaultSession): void {
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    log.warn('permission request denied:', permission);
    callback(false);
  });
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
  ses.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  ses.setSpellCheckerEnabled(false);
  ses.on('select-hid-device', (event, _details, callback) => {
    event.preventDefault();
    callback();
  });
  ses.on('select-serial-port', (event, _ports, _contents, callback) => {
    event.preventDefault();
    callback('');
  });
  ses.on('select-usb-device', (event, _details, callback) => {
    event.preventDefault();
    callback();
  });
  // Windows and Linux only; macOS pairs through the OS.
  if (process.platform !== 'darwin') ses.setBluetoothPairingHandler((_details, callback) => callback({ confirmed: false }));
}

/** Every webContents: no new windows (http(s) links open in the browser) and no webviews. */
export function hardenAllWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      void openExternalLink(url, BrowserWindow.fromWebContents(contents) ?? undefined);
      return { action: 'deny' };
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.on('select-bluetooth-device', (event, _devices, callback) => {
      event.preventDefault();
      callback('');
    });
  });
}

/** App windows never navigate: content is loaded once, then only reloaded. */
export function blockNavigation(contents: WebContents): void {
  contents.on('will-navigate', (event) => {
    // `location.reload()` fires this too, with the URL that's already loaded:
    // Vite's full reload after it optimizes dependencies on a cold cache
    // (`yarn start`), and the error boundary's fallback. That's a reload.
    if (event.url === contents.getURL()) return;
    event.preventDefault();
    void openExternalLink(
      event.url,
      BrowserWindow.fromWebContents(contents) ?? undefined,
    );
  });
  contents.on('will-redirect', (event) => event.preventDefault());
  contents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame || event.url !== contents.getURL()) event.preventDefault();
  });
}

/** Opens only parsed http(s) URLs, and only after the user confirms. */
export async function openExternalLink(
  url: string,
  parent?: BrowserWindow,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
  const { response } = await messageBox(parent, {
    type: 'question',
    message: t('openLinkMessage'),
    detail: parsed.href,
    buttons: [t('openLink'), t('cancel')],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) await shell.openExternal(parsed.href);
}
