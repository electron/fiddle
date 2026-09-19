import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isPackaged: true,
  updatesFlag: true,
  fetch: vi.fn(),
  updateElectronApp: vi.fn(),
  dispatchUpdateAvailable: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.isPackaged;
    },
    getVersion: () => '1.2.3',
  },
  BrowserWindow: { getAllWindows: () => [{ webContents: {} }] },
  net: { fetch: mocks.fetch },
}));
vi.mock('update-electron-app', () => ({
  updateElectronApp: mocks.updateElectronApp,
  makeUserNotifier: () => undefined,
  UpdateSourceType: { ElectronPublicUpdateService: 1 },
}));
vi.mock('../../ipc/main', () => ({
  AppPlatform: {
    getDispatcher: () => ({ dispatchUpdateAvailable: mocks.dispatchUpdateAvailable }),
  },
}));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../security', () => ({ openExternalLink: vi.fn() }));
vi.mock('../test-mode', () => ({
  getEndpoints: () => ({ githubApi: 'https://api.github.test' }),
  testFlags: () => ({ updates: mocks.updatesFlag }),
}));

import { startUpdates } from './index';

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

beforeEach(() => {
  vi.useFakeTimers();
  mocks.isPackaged = true;
  mocks.updatesFlag = true;
  mocks.fetch.mockReset();
  mocks.updateElectronApp.mockClear();
  mocks.dispatchUpdateAvailable.mockClear();
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

  describe('Linux', () => {
    beforeEach(() => setPlatform('linux'));

    const release = (tag: string) => ({
      tag_name: tag,
      html_url: `https://github.com/electron/fiddle/releases/tag/${tag}`,
    });

    it('announces a newer release once, however often it checks', async () => {
      serve([release('v1.3.0')]);
      startUpdates();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenCalledExactlyOnceWith('1.3.0');

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenCalledOnce();

      serve([release('v1.4.0')]);
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenLastCalledWith('1.4.0');
    });

    it('says nothing when the release check fails', async () => {
      mocks.fetch.mockImplementation(async () => json({}, 500));
      startUpdates();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.dispatchUpdateAvailable).not.toHaveBeenCalled();
    });
  });
});
