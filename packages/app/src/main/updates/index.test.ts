import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isPackaged: true,
  updatesFlag: true,
  fetch: vi.fn(),
  updateElectronApp: vi.fn(),
  dispatchUpdateAvailable: vi.fn(),
  showMessageBox: vi.fn(),
  confirmQuit: vi.fn(),
  quitAndInstall: vi.fn(),
  windowCreated: undefined as ((event: unknown, win: unknown) => void) | undefined,
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.isPackaged;
    },
    getVersion: () => '1.2.3',
    on: (event: string, listener: (event: unknown, win: unknown) => void) => {
      if (event === 'browser-window-created') mocks.windowCreated = listener;
    },
  },
  autoUpdater: { quitAndInstall: mocks.quitAndInstall },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: { showMessageBox: mocks.showMessageBox },
  net: { fetch: mocks.fetch },
}));
vi.mock('update-electron-app', () => ({
  updateElectronApp: mocks.updateElectronApp,
  UpdateSourceType: { ElectronPublicUpdateService: 1 },
}));
vi.mock('../../ipc/main', () => ({
  AppPlatform: {
    getDispatcher: (contents: { name: string }) => ({
      dispatchUpdateAvailable: (version: string) =>
        mocks.dispatchUpdateAvailable(contents.name, version),
    }),
  },
}));
vi.mock('../documents/service', () => ({ confirmQuit: mocks.confirmQuit }));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../security', () => ({ openExternalLink: vi.fn() }));
vi.mock('../test-mode', () => ({
  getEndpoints: () => ({ githubApi: 'https://api.github.test' }),
  testFlags: () => ({ updates: mocks.updatesFlag }),
}));

let startUpdates: typeof import('./index').startUpdates;

const realPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function serve(releases: unknown[]): void {
  mocks.fetch.mockImplementation(async () => json(releases));
}

/** A window that the app announces through `browser-window-created`. */
function openWindow(name: string, visible: boolean) {
  const win = Object.assign(new EventEmitter(), {
    webContents: { name },
    isVisible: () => visible,
    isDestroyed: () => false,
  });
  mocks.windowCreated?.({}, win);
  return { show: () => win.emit('show') };
}

beforeEach(async () => {
  vi.resetModules();
  ({ startUpdates } = await import('./index'));
  vi.useFakeTimers();
  mocks.isPackaged = true;
  mocks.updatesFlag = true;
  mocks.fetch.mockReset();
  mocks.updateElectronApp.mockClear();
  mocks.dispatchUpdateAvailable.mockClear();
  mocks.quitAndInstall.mockClear();
  mocks.windowCreated = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  setPlatform(realPlatform);
});

describe('startUpdates', () => {
  it('does nothing in dev or test mode', async () => {
    mocks.isPackaged = false;
    startUpdates();
    mocks.isPackaged = true;
    mocks.updatesFlag = false;
    startUpdates();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.updateElectronApp).not.toHaveBeenCalled();
  });

  it('installs a downloaded update only after the usual unsaved-changes check', async () => {
    setPlatform('darwin');
    startUpdates();
    await vi.advanceTimersByTimeAsync(10_000);
    const [{ onNotifyUser }] = mocks.updateElectronApp.mock.lastCall as [
      { onNotifyUser: () => void },
    ];
    mocks.showMessageBox.mockResolvedValue({ response: 0 });

    mocks.confirmQuit.mockResolvedValueOnce(false);
    onNotifyUser();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.quitAndInstall).not.toHaveBeenCalled();

    mocks.confirmQuit.mockResolvedValueOnce(true);
    onNotifyUser();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.quitAndInstall).toHaveBeenCalledOnce();
  });

  describe('Linux', () => {
    beforeEach(() => setPlatform('linux'));

    const release = (tag: string) => ({
      tag_name: tag,
      html_url: `https://github.com/electron/fiddle/releases/tag/${tag}`,
    });

    it('announces a newer release once, however often it checks', async () => {
      serve([release('v1.3.0')]);
      startUpdates();
      openWindow('a', true);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenCalledExactlyOnceWith('a', '1.3.0');

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenCalledOnce();

      serve([release('v1.4.0')]);
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenLastCalledWith('a', '1.4.0');
    });

    it('tells a window once it is shown, if it opened after the check or was not ready', async () => {
      serve([release('v1.3.0')]);
      startUpdates();
      const early = openWindow('early', false);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.dispatchUpdateAvailable).not.toHaveBeenCalled();

      early.show();
      expect(mocks.dispatchUpdateAvailable).toHaveBeenCalledExactlyOnceWith(
        'early',
        '1.3.0',
      );

      openWindow('late', false).show();
      expect(mocks.dispatchUpdateAvailable).toHaveBeenLastCalledWith('late', '1.3.0');
      expect(mocks.dispatchUpdateAvailable).toHaveBeenCalledTimes(2);
    });

    it('says nothing when the release check fails', async () => {
      mocks.fetch.mockImplementation(async () => json({}, 500));
      startUpdates();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.dispatchUpdateAvailable).not.toHaveBeenCalled();
    });
  });
});
