/**
 * `file://` is never loaded except by the one-time localStorage import
 * (migration/local-storage.ts), which runs before these handlers are installed,
 * so its window locks itself down.
 */
import { app, BrowserWindow, session, shell, type WebContents } from 'electron';

import { confirm } from './dialogs';
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
  if (process.platform !== 'darwin')
    ses.setBluetoothPairingHandler((_details, callback) =>
      callback({ confirmed: false }),
    );
}

/** Every webContents: no new windows (http(s) links open in the browser) and no webviews. */
export function hardenAllWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      offerExternalLink(url, contents);
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
    offerExternalLink(event.url, contents);
  });
  contents.on('will-redirect', (event) => event.preventDefault());
  contents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame || event.url !== contents.getURL()) event.preventDefault();
  });
}

/** A link the page tried to open: nobody awaits it, so a failure is logged here. */
function offerExternalLink(url: string, contents: WebContents): void {
  openExternalLink(url, BrowserWindow.fromWebContents(contents) ?? undefined).catch(
    (error: unknown) => log.warn('opening a link failed', error),
  );
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
  const open = await confirm(parent, {
    message: t('openLinkMessage'),
    detail: parsed.href,
    ok: t('openLink'),
  });
  if (open) await shell.openExternal(parsed.href);
}
