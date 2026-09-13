/**
 * App windows, built to Lucent's "Glass on real windows"
 * (docs/design/lucent-handover.txt, docs/design/window-options.js): the OS
 * material shows through a transparent page, and Lucent paints a thin tint.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  app,
  BrowserWindow,
  nativeTheme,
  type BrowserWindowConstructorOptions,
} from 'electron';

import type { Material, Platform } from '../shared/stores';
import { APP_ORIGIN } from './bundle';
import type { CommandRegistry } from './commands';
import { bindWindowIpc } from './ipc';
import { log } from './log';
import { blockNavigation } from './security';
import type { StateHub } from './state-hub';
import { trackWindow, untrackWindow } from './windows';

/** Matches the renderer name in forge.config.ts and vite.renderer.config.ts. */
const RENDERER_NAME = 'main_window';
const TITLE_BAR_HEIGHT = 56;
/** Lucent --lu-ink, for the Windows caption buttons. */
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

export interface RendererEntry {
  /** What windows load. */
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

const inkColor = () => (nativeTheme.shouldUseDarkColors ? INK.dark : INK.light);

export function windowOptions(
  platform: Platform,
  material: Material,
): BrowserWindowConstructorOptions {
  const common: BrowserWindowConstructorOptions = {
    width: 1280,
    height: 820,
    // REQUIREMENTS §14: fully usable at 600×600 (Lucent's sample uses 880×560).
    minWidth: 600,
    minHeight: 600,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      spellcheck: false,
    },
  };
  if (platform === 'darwin') {
    return {
      ...common,
      titleBarStyle: 'hiddenInset',
      // Traffic lights centred in the 56px title bar.
      trafficLightPosition: { x: 20, y: 22 },
      vibrancy: 'under-window',
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
  // Linux: native frame and no material; the renderer adds `lu-no-material`.
  return common;
}

export interface CreateWindowOptions {
  hub: StateHub;
  registry: CommandRegistry;
  url: string;
  platform: Platform;
}

export async function createAppWindow({
  hub,
  registry,
  url,
  platform,
}: CreateWindowOptions): Promise<BrowserWindow> {
  const windowId = randomUUID();
  const win = new BrowserWindow(windowOptions(platform, hub.app.material));
  const contents = win.webContents;
  trackWindow(windowId, win);
  blockNavigation(contents);

  let shown = false;
  bindWindowIpc({
    contents,
    windowId,
    init: { title: app.getName() },
    hub,
    registry,
    // Also called after every reload; only the first one shows the window.
    onReady: () => {
      if (shown || win.isDestroyed()) return;
      shown = true;
      win.show();
      log.info('window ready', windowId, contents.getURL());
      devScreenshot(win).catch((error: unknown) =>
        log.error('dev screenshot failed', error),
      );
    },
  });

  contents.once('destroyed', () => {
    hub.unregisterWindow(windowId);
    untrackWindow(windowId);
  });
  contents.on('did-fail-load', (_event, code, description, failedUrl) => {
    log.error('window failed to load', failedUrl, code, description);
  });
  contents.on('render-process-gone', (_event, details) => {
    log.error('renderer process gone', windowId, details.reason);
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
}

/**
 * Dev tooling only (`yarn start:xvfb`): FIDDLE_DEV_SCREENSHOT=<file.png> saves
 * the first window once it's ready, FIDDLE_DEV_QUIT=1 then quits. Compiled out
 * of production-mode builds (`vite build` keeps `import.meta.env.DEV` false
 * even in development mode, so this checks MODE).
 */
async function devScreenshot(win: BrowserWindow): Promise<void> {
  const file = process.env.FIDDLE_DEV_SCREENSHOT;
  if (import.meta.env.MODE === 'production' || app.isPackaged || !file) return;
  const image = await win.webContents.capturePage();
  await fs.writeFile(file, image.toPNG());
  log.info('dev screenshot saved', file, image.getSize());
  if (process.env.FIDDLE_DEV_QUIT === '1') app.quit();
}
