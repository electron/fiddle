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

import { DEFAULT_LAYOUT, type Material, type Platform } from '../shared/stores';
import { APP_ORIGIN } from './bundle';
import { attachContextMenu } from './context-menu';
import { emptyFiddleState } from './documents/model';
import { attachWindow } from './documents/service';
import { bindWindowIpc } from './ipc';
import { log } from './log';
import { blockNavigation } from './security';
import type { Services } from './services';
import type { WindowInit } from './state-hub';
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

type Vibrancy = NonNullable<Electron.BrowserWindowConstructorOptions['vibrancy']>;
const VIBRANCIES: readonly Vibrancy[] = ['appearance-based', 'titlebar', 'selection', 'menu', 'popover', 'sidebar', 'header', 'sheet', 'window', 'hud', 'fullscreen-ui', 'tooltip', 'content', 'under-window', 'under-page'];

/** `FIDDLE_VIBRANCY=fullscreen-ui yarn start`: try another macOS material in an unpackaged app. */
function devVibrancy(): Vibrancy | undefined {
  const value = process.env.FIDDLE_VIBRANCY as Vibrancy | undefined;
  return !app.isPackaged && value && VIBRANCIES.includes(value) ? value : undefined;
}

interface RendererEntry {
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

function windowOptions(
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
      // The handover says 'under-window'; 'sidebar' is more translucent and reads closer to the design (owner's call, 2026-09-16).
      vibrancy: devVibrancy() ?? 'sidebar',
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

export async function createAppWindow({
  services,
  url,
  windowId = randomUUID(),
  init,
}: {
  services: Services;
  url: string;
  /** Session restore reopens a window under its old ID. */
  windowId?: string;
  /** The window's initial store value; Documents provides the fiddle part. */
  init?: WindowInit;
}): Promise<BrowserWindow> {
  const { hub, platform } = services;
  const win = new BrowserWindow(windowOptions(platform, hub.app.material));
  const contents = win.webContents;
  trackWindow(windowId, win);
  blockNavigation(contents);
  // Documents: close prompts, focus tracking and dropped folders. Its
  // `destroyed` handler runs before the one below, while the window is registered.
  attachWindow(windowId, contents);
  attachContextMenu(windowId, contents, services);

  let shown = false;
  const initial = init ?? { title: app.getName(), view: 'editor', fiddle: emptyFiddleState(), layout: DEFAULT_LAYOUT };
  // Also called after every reload; only the first one shows the window.
  bindWindowIpc({ contents, windowId, services }, initial, () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    win.show();
    log.info('window ready', windowId, contents.getURL());
    devScreenshot(win).catch((error: unknown) => log.error('dev screenshot failed', error));
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
