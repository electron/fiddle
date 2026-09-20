import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  app,
  BrowserWindow,
  nativeTheme,
  type BrowserWindowConstructorOptions,
  type WebPreferences,
} from 'electron';

import type { Material, Platform } from '../shared/stores';
import { APP_ORIGIN } from './bundle';
import { attachContextMenu } from './context-menu';
import { attachWindow } from './documents/service';
import { bindWindowIpc } from './ipc';
import { log } from './log';
import { blockNavigation } from './security';
import type { Services } from './services';
import type { WindowInit } from './state-hub';
import { trackWindow, untrackWindow } from './windows';

/** Must match the renderer name in forge.config.ts and vite.renderer.config.mts. */
const RENDERER_NAME = 'main_window';
// The title bar height and `--lu-ink` must match the Lucent CSS: the OS draws the caption buttons.
const TITLE_BAR_HEIGHT = 56;
/** How long a loaded page may take to report ready before the window is shown anyway. */
const READY_TIMEOUT_MS = 5000;
/** A crashed renderer is reloaded at most this many times per `CRASH_RELOAD_WINDOW_MS`; a page that crashes on load would loop. */
const MAX_CRASH_RELOADS = 3;
const CRASH_RELOAD_WINDOW_MS = 60_000;
const INK = { light: '#1b1c26', dark: '#eef1f8' } as const;

export function detectPlatform(): Platform {
  return process.platform === 'darwin' || process.platform === 'win32'
    ? process.platform
    : 'linux';
}

/** The OS material under the chrome. Windows 11 (build 22000+) has acrylic; Linux has none. */
export function detectMaterial(platform: Platform): Material {
  if (platform === 'darwin') return 'vibrancy';
  if (platform === 'win32')
    return Number(os.release().split('.')[2] ?? 0) >= 22000 ? 'acrylic' : 'none';
  return 'none';
}

interface RendererEntry {
  url: string;
  /** Built renderer served over app://. */
  rendererDir: string;
  /** Set only for an unpackaged app under `electron-forge start`. */
  devServerUrl: string | undefined;
}

export function rendererEntry(): RendererEntry {
  const devServerUrl =
    !app.isPackaged && typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string'
      ? MAIN_WINDOW_VITE_DEV_SERVER_URL
      : undefined;
  return {
    url: devServerUrl ?? `${APP_ORIGIN}/index.html`,
    rendererDir: path.join(__dirname, '..', 'renderer', RENDERER_NAME),
    devServerUrl,
  };
}

/** Every window's web preferences; app windows add the preload. */
const webPreferences: WebPreferences = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  nodeIntegrationInSubFrames: false,
  webSecurity: true,
  spellcheck: false,
};

const inkColor = () => (nativeTheme.shouldUseDarkColors ? INK.dark : INK.light);

export function windowOptions(
  platform: Platform,
  material: Material,
): BrowserWindowConstructorOptions {
  const common: BrowserWindowConstructorOptions = {
    width: 1280,
    height: 820,
    // The layout stays usable down to 600×600.
    minWidth: 600,
    minHeight: 600,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), ...webPreferences },
  };
  if (platform === 'darwin') {
    return {
      ...common,
      titleBarStyle: 'hiddenInset',
      // Traffic lights centred in the title bar.
      trafficLightPosition: { x: 20, y: 22 },
      // More translucent than 'under-window'.
      vibrancy: 'sidebar',
      visualEffectState: 'followWindow',
    };
  }
  if (platform === 'win32') {
    return {
      ...common,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: inkColor(),
        height: TITLE_BAR_HEIGHT,
      },
      ...(material === 'acrylic' ? { backgroundMaterial: 'acrylic' as const } : {}),
    };
  }
  // Linux: native frame, no material. The menu bar is drawn in the title bar, so
  // the native one stays hidden: auto-hide keeps `Menu.setApplicationMenu` from
  // showing it, while the menu it sets still gives the window its accelerators.
  return { ...common, autoHideMenuBar: true };
}

export async function createAppWindow({
  services,
  url,
  windowId,
  init,
}: {
  services: Services;
  url: string;
  windowId: string;
  init: WindowInit;
}): Promise<BrowserWindow> {
  const { hub, platform } = services;
  const win = new BrowserWindow(windowOptions(platform, hub.app.material));
  if (platform === 'linux') win.setMenuBarVisibility(false);
  const contents = win.webContents;
  trackWindow(windowId, win);
  blockNavigation(contents);
  // Documents' `destroyed` handler must run before the one below, while the window is still registered.
  attachWindow(windowId, contents);
  attachContextMenu(windowId, contents, services);
  contents.once('destroyed', () => {
    hub.unregisterWindow(windowId);
    untrackWindow(windowId);
    // Open only while a fiddle window is: it must not keep the app running after the last one closes.
    if (hub.windowIds.length === 0) gallery?.close();
  });

  try {
    let shown = false;
    let readyTimer: NodeJS.Timeout | undefined;
    const show = () => {
      clearTimeout(readyTimer);
      if (shown || win.isDestroyed()) return;
      shown = true;
      win.show();
      log.info('window ready', windowId, contents.getURL());
      devScreenshot(win).catch((error: unknown) =>
        log.error('dev screenshot failed', error),
      );
    };
    // Also called after every reload; only the first one shows the window.
    bindWindowIpc({ contents, windowId, services }, init, show);

    // A page that loads but never reports ready (its script failed) would stay hidden for good.
    contents.on('did-finish-load', () => {
      if (shown) return;
      readyTimer ??= setTimeout(() => {
        log.error('the page did not report ready; showing the window anyway', windowId);
        show();
      }, READY_TIMEOUT_MS);
    });
    contents.on('did-fail-load', (_event, code, description, failedUrl) => {
      log.error('window failed to load', failedUrl, code, description);
    });
    // Main owns the document and both stores, so a reload brings the window back as it was.
    const reloads: number[] = [];
    contents.on('render-process-gone', (_event, details) => {
      log.error('renderer process gone', windowId, details.reason);
      if (details.reason === 'clean-exit' || contents.isDestroyed()) return;
      const now = Date.now();
      while (reloads[0] !== undefined && now - reloads[0] >= CRASH_RELOAD_WINDOW_MS)
        reloads.shift();
      if (reloads.length >= MAX_CRASH_RELOADS) {
        log.error('the renderer keeps crashing; leaving the window as it is', windowId);
        // A window that never got shown would stay hidden and keep the app alive.
        show();
        return;
      }
      reloads.push(now);
      contents.reload();
    });

    if (platform === 'win32') {
      const updateOverlay = () => {
        if (!win.isDestroyed()) win.setTitleBarOverlay({ symbolColor: inkColor() });
      };
      nativeTheme.on('updated', updateOverlay);
      win.once('closed', () => nativeTheme.off('updated', updateOverlay));
    }

    await win.loadURL(url);
    return win;
  } catch (error) {
    // Not shown yet: without this an invisible window would keep the app alive.
    win.destroy();
    throw error;
  }
}

/** Bundled only outside release builds (`vite.renderer.config.mts`). */
const GALLERY_PATH = 'src/ui/gallery/index.html';
let gallery: BrowserWindow | undefined;

/** Develop > Open component gallery. No preload and no state: the page is plain UI. */
export async function openGalleryWindow(): Promise<void> {
  if (gallery && !gallery.isDestroyed()) {
    gallery.show();
    gallery.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    webPreferences,
  });
  gallery = win;
  win.setMenuBarVisibility(false);
  blockNavigation(win.webContents);
  win.once('closed', () => {
    if (gallery === win) gallery = undefined;
  });
  try {
    await win.loadURL(new URL(GALLERY_PATH, rendererEntry().url).href);
    win.show();
  } catch (error) {
    win.destroy();
    throw error;
  }
}

/**
 * Dev only (`yarn start:xvfb`): FIDDLE_DEV_SCREENSHOT=<file.png> saves the first
 * ready window, FIDDLE_DEV_QUIT=1 then quits. Checks MODE because `vite build`
 * keeps `import.meta.env.DEV` false even in development mode.
 */
async function devScreenshot(win: BrowserWindow): Promise<void> {
  const file = process.env.FIDDLE_DEV_SCREENSHOT;
  if (import.meta.env.MODE === 'production' || app.isPackaged || !file) return;
  // Just shown: the page's first frames take a moment to reach the screen.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const image = await win.webContents.capturePage();
  await fs.writeFile(file, image.toPNG());
  log.info('dev screenshot saved', file, image.getSize());
  if (process.env.FIDDLE_DEV_QUIT === '1') app.quit();
}
