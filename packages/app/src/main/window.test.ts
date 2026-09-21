/** App windows: their locked-down options, when they show, crash reloads, the Windows title bar overlay and the gallery window. */
import { EventEmitter } from 'node:events';
import os from 'node:os';

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const mocks = vi.hoisted(() => ({
  windows: [] as unknown[],
  loadURL: vi.fn<(url: string) => Promise<void>>(),
  bindWindowIpc: vi.fn(),
  attachWindow: vi.fn(),
  trackWindow: vi.fn(),
  untrackWindow: vi.fn(),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class BrowserWindow extends EventEmitter {
    readonly options: unknown;
    readonly webContents = Object.assign(new EventEmitter(), {
      getURL: () => 'app://main/index.html',
      isDestroyed: () => false,
      reload: vi.fn(),
    });
    destroyed = false;
    show = vi.fn();
    focus = vi.fn();
    close = vi.fn(() => {
      this.destroyed = true;
      this.emit('closed');
    });
    destroy = vi.fn(() => {
      this.destroyed = true;
    });
    setMenuBarVisibility = vi.fn();
    setTitleBarOverlay = vi.fn();
    isDestroyed = () => this.destroyed;
    loadURL = (url: string) => mocks.loadURL(url);
    constructor(options: unknown) {
      super();
      this.options = options;
      mocks.windows.push(this);
    }
  }
  return {
    app: { getName: () => 'Electron Fiddle', isPackaged: true },
    BrowserWindow,
    nativeTheme: Object.assign(new EventEmitter(), { shouldUseDarkColors: false }),
  };
});
vi.mock('./context-menu', () => ({ attachContextMenu: vi.fn() }));
vi.mock('./documents/service', () => ({ attachWindow: mocks.attachWindow }));
vi.mock('./ipc', () => ({ bindWindowIpc: mocks.bindWindowIpc }));
vi.mock('./log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./security', () => ({ blockNavigation: vi.fn() }));
vi.mock('./windows', () => ({
  trackWindow: mocks.trackWindow,
  untrackWindow: mocks.untrackWindow,
}));

import { nativeTheme } from 'electron';

import { log } from './log';
import {
  createAppWindow,
  detectMaterial,
  openGalleryWindow,
  windowOptions,
} from './window';

interface FakeWindow extends EventEmitter {
  options: { webPreferences: Record<string, unknown> };
  webContents: EventEmitter & { reload: Mock<() => void> };
  show: ReturnType<typeof vi.fn>;
  close: Mock<() => void>;
  destroy: ReturnType<typeof vi.fn>;
  setTitleBarOverlay: Mock<(overlay: { symbolColor: string }) => void>;
}

const hub = {
  app: { material: 'none' },
  windowIds: [] as string[],
  unregisterWindow: vi.fn(),
};
const services = { hub, platform: 'linux' } as never;
const args = {
  services,
  url: 'app://main/index.html',
  windowId: 'w',
  init: {} as never,
};

function lastWindow(): FakeWindow {
  return mocks.windows.at(-1) as FakeWindow;
}

/** The `onReady` callback the window gave to `bindWindowIpc`. */
function reportReady(): void {
  (mocks.bindWindowIpc.mock.calls.at(-1)![2] as () => void)();
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.windows.length = 0;
  mocks.loadURL.mockReset().mockResolvedValue(undefined);
  mocks.bindWindowIpc.mockReset();
  mocks.trackWindow.mockClear();
  mocks.untrackWindow.mockClear();
  hub.unregisterWindow.mockClear();
  vi.mocked(log.error).mockClear();
});

describe('detectMaterial', () => {
  it('gives macOS vibrancy, Windows 11 acrylic, and older Windows and Linux nothing', () => {
    expect(detectMaterial('darwin')).toBe('vibrancy');
    expect(detectMaterial('linux')).toBe('none');
    const release = vi.spyOn(os, 'release');
    release.mockReturnValue('10.0.22631');
    expect(detectMaterial('win32')).toBe('acrylic');
    release.mockReturnValue('10.0.19045');
    expect(detectMaterial('win32')).toBe('none');
    release.mockRestore();
  });
});

describe('windowOptions', () => {
  it('draws the Windows caption buttons over a hidden title bar, in the ink colour of the theme', () => {
    const dark = vi.spyOn(nativeTheme, 'shouldUseDarkColors', 'get');
    dark.mockReturnValue(false);
    expect(windowOptions('win32', 'acrylic')).toMatchObject({
      titleBarStyle: 'hidden',
      titleBarOverlay: { symbolColor: '#1b1c26', height: 56 },
      backgroundMaterial: 'acrylic',
    });
    dark.mockReturnValue(true);
    expect(windowOptions('win32', 'none').titleBarOverlay).toMatchObject({
      symbolColor: '#eef1f8',
    });
    expect(windowOptions('win32', 'none')).not.toHaveProperty('backgroundMaterial');
    dark.mockRestore();
  });

  it.each(['darwin', 'win32', 'linux'] as const)(
    'locks the renderer down on %s',
    (platform) => {
      const { webPreferences } = windowOptions(platform, 'none');
      expect(webPreferences).toMatchObject({
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        webSecurity: true,
      });
      expect(webPreferences?.preload).toMatch(/preload\.js$/);
      expect(windowOptions(platform, 'none').show).toBe(false);
    },
  );
});

describe('createAppWindow', () => {
  it('starts hidden and shows the window once, when the renderer reports ready', async () => {
    const win = await createAppWindow(args).then(() => lastWindow());
    expect(win.show).not.toHaveBeenCalled();
    reportReady();
    reportReady();
    expect(win.show).toHaveBeenCalledOnce();
  });

  it('recolours the Windows caption buttons with the theme while the window is open', async () => {
    const dark = vi
      .spyOn(nativeTheme, 'shouldUseDarkColors', 'get')
      .mockReturnValue(false);
    await createAppWindow({ ...args, services: { hub, platform: 'win32' } as never });
    const win = lastWindow();
    dark.mockReturnValue(true);
    nativeTheme.emit('updated');
    expect(win.setTitleBarOverlay).toHaveBeenLastCalledWith({ symbolColor: '#eef1f8' });
    win.close();
    nativeTheme.emit('updated');
    expect(win.setTitleBarOverlay).toHaveBeenCalledOnce();
    expect(nativeTheme.listenerCount('updated')).toBe(0);
    dark.mockRestore();
  });

  describe('a page that loads but never reports ready', () => {
    it('is shown after a wait, so its failure is visible', async () => {
      await createAppWindow(args);
      const win = lastWindow();
      win.webContents.emit('did-finish-load');
      await vi.advanceTimersByTimeAsync(4999);
      expect(win.show).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(win.show).toHaveBeenCalledOnce();
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('did not report ready'),
        'w',
      );
    });

    it('is left alone when it reports ready in time', async () => {
      await createAppWindow(args);
      const win = lastWindow();
      win.webContents.emit('did-finish-load');
      reportReady();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(win.show).toHaveBeenCalledOnce();
      expect(log.error).not.toHaveBeenCalled();
    });
  });

  describe('a renderer that crashes', () => {
    const crash = (win: FakeWindow, reason = 'crashed') =>
      win.webContents.emit('render-process-gone', {}, { reason });

    it('is reloaded, unless it exited cleanly', async () => {
      await createAppWindow(args);
      const win = lastWindow();
      crash(win, 'clean-exit');
      expect(win.webContents.reload).not.toHaveBeenCalled();
      crash(win, 'oom');
      expect(win.webContents.reload).toHaveBeenCalledOnce();
    });

    it('is left as it is once it crashes three times in a minute, and shown if it never was', async () => {
      await createAppWindow(args);
      const win = lastWindow();
      for (let i = 0; i < 3; i++) crash(win);
      expect(win.webContents.reload).toHaveBeenCalledTimes(3);
      expect(win.show).not.toHaveBeenCalled();

      crash(win);
      expect(win.webContents.reload).toHaveBeenCalledTimes(3);
      expect(win.show).toHaveBeenCalledOnce();
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('keeps crashing'),
        'w',
      );

      await vi.advanceTimersByTimeAsync(59_999);
      crash(win);
      expect(win.webContents.reload).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(1);
      crash(win);
      expect(win.webContents.reload).toHaveBeenCalledTimes(4);
    });
  });

  describe('a window that cannot start', () => {
    it('is destroyed and forgotten when loading fails', async () => {
      mocks.loadURL.mockRejectedValue(new Error('ERR_FILE_NOT_FOUND'));
      await expect(createAppWindow(args)).rejects.toThrow('ERR_FILE_NOT_FOUND');
      const win = lastWindow();
      expect(win.destroy).toHaveBeenCalledOnce();

      win.webContents.emit('destroyed');
      expect(hub.unregisterWindow).toHaveBeenCalledWith('w');
      expect(mocks.untrackWindow).toHaveBeenCalledWith('w');
    });

    it('is destroyed and forgotten when its IPC cannot be bound', async () => {
      mocks.bindWindowIpc.mockImplementation(() => {
        throw new Error('Window w is already registered');
      });
      await expect(createAppWindow(args)).rejects.toThrow('already registered');
      const win = lastWindow();
      expect(win.destroy).toHaveBeenCalledOnce();
      expect(mocks.loadURL).not.toHaveBeenCalled();

      win.webContents.emit('destroyed');
      expect(hub.unregisterWindow).toHaveBeenCalledWith('w');
      expect(mocks.untrackWindow).toHaveBeenCalledWith('w');
    });
  });
});

describe('openGalleryWindow', () => {
  it('opens the gallery page in a locked-down window without the preload, once at a time', async () => {
    await openGalleryWindow();
    const win = lastWindow();
    expect(mocks.loadURL).toHaveBeenCalledWith('app://main/src/ui/gallery/index.html');
    expect(win.options.webPreferences).toMatchObject({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    });
    expect(win.options.webPreferences).not.toHaveProperty('preload');
    expect(win.show).toHaveBeenCalledOnce();
    expect(mocks.trackWindow).not.toHaveBeenCalled();

    await openGalleryWindow();
    expect(mocks.windows).toHaveLength(1);
    win.close();
  });

  it('is destroyed when its page cannot load, and the next attempt opens a new one', async () => {
    mocks.loadURL.mockRejectedValueOnce(new Error('ERR_FAILED'));
    await expect(openGalleryWindow()).rejects.toThrow('ERR_FAILED');
    const failed = lastWindow();
    expect(failed.destroy).toHaveBeenCalledOnce();
    expect(failed.show).not.toHaveBeenCalled();

    await openGalleryWindow();
    expect(mocks.windows).toHaveLength(2);
    expect(lastWindow().show).toHaveBeenCalledOnce();
    lastWindow().close();
  });

  it('closes with the last fiddle window, so it never keeps the app running', async () => {
    await openGalleryWindow();
    const gallery = lastWindow();
    await createAppWindow(args);
    const first = lastWindow();
    await createAppWindow({ ...args, windowId: 'w2' });
    const second = lastWindow();

    hub.windowIds = ['w2'];
    first.webContents.emit('destroyed');
    expect(gallery.close).not.toHaveBeenCalled();

    hub.windowIds = [];
    second.webContents.emit('destroyed');
    expect(gallery.close).toHaveBeenCalledOnce();
  });
});
