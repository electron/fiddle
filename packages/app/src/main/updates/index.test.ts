import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isPackaged: true,
  updatesFlag: true,
  fetch: vi.fn(),
  showMessageBox: vi.fn(),
  openExternal: vi.fn(async () => undefined),
  quit: vi.fn(),
  updateElectronApp: vi.fn(),
  dispatchUpdateAvailable: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.isPackaged;
    },
    getVersion: () => '1.2.3',
    quit: mocks.quit,
  },
  BrowserWindow: { getAllWindows: () => [{ webContents: {} }] },
  dialog: { showMessageBox: mocks.showMessageBox },
  net: { fetch: mocks.fetch },
  shell: { openExternal: mocks.openExternal },
}));
vi.mock('update-electron-app', () => ({
  updateElectronApp: mocks.updateElectronApp,
  makeUserNotifier: () => undefined,
  UpdateSourceType: { StaticStorage: 0, ElectronPublicUpdateService: 1 },
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

/** Answers the policy request with `policy` and the releases request with `releases`. */
function serve({
  policy,
  releases = [],
}: {
  policy?: Response | Error;
  releases?: unknown[];
}): void {
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.includes('update-policy')) {
      if (policy instanceof Error) throw policy;
      return policy ?? json({});
    }
    return json(releases);
  });
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  mocks.isPackaged = true;
  mocks.updatesFlag = true;
  mocks.fetch.mockReset();
  mocks.showMessageBox.mockReset().mockResolvedValue({ response: 1 });
  mocks.openExternal.mockClear();
  mocks.quit.mockClear();
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
    startUpdates({ beta: false });
    mocks.isPackaged = true;
    mocks.updatesFlag = false;
    startUpdates({ beta: false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.updateElectronApp).not.toHaveBeenCalled();
  });

  describe('the kill switch', () => {
    it('shows the notice for a blocked version and quits', async () => {
      serve({ policy: json({ blockedVersions: ['1.2.x'], message: 'Broken build' }) });
      startUpdates({ beta: false });
      await flush();
      expect(mocks.showMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', detail: 'Broken build' }),
      );
      expect(mocks.quit).toHaveBeenCalledOnce();
      expect(mocks.openExternal).not.toHaveBeenCalled();
    });

    it('quits after opening the download page too', async () => {
      mocks.showMessageBox.mockResolvedValue({ response: 0 });
      serve({ policy: json({ minVersion: '2.0.0' }) });
      startUpdates({ beta: false });
      await flush();
      expect(mocks.openExternal).toHaveBeenCalledOnce();
      expect(mocks.quit).toHaveBeenCalledOnce();
    });

    it('carries on when the policy is missing, unreachable, invalid or does not list this version', async () => {
      for (const policy of [
        json({}, 404),
        new Error('offline'),
        json({ blockedVersions: 'nope' }),
        json({ blockedVersions: ['1.2.4'], minVersion: '1.0.0' }),
      ]) {
        serve({ policy });
        startUpdates({ beta: false });
        await flush();
      }
      expect(mocks.showMessageBox).not.toHaveBeenCalled();
      expect(mocks.quit).not.toHaveBeenCalled();
    });
  });

  describe('Linux', () => {
    beforeEach(() => setPlatform('linux'));

    const release = (tag: string) => ({
      tag_name: tag,
      html_url: `https://github.com/electron/fiddle/releases/tag/${tag}`,
    });

    it('announces a newer release once, however often it checks', async () => {
      serve({ releases: [release('v1.3.0')] });
      startUpdates({ beta: false });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenCalledExactlyOnceWith('1.3.0');

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenCalledOnce();

      serve({ releases: [release('v1.4.0')] });
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mocks.dispatchUpdateAvailable).toHaveBeenLastCalledWith('1.4.0');
    });

    it('says nothing when the release check fails', async () => {
      mocks.fetch.mockImplementation(async (url: string) =>
        url.includes('update-policy') ? json({}) : json({}, 500),
      );
      startUpdates({ beta: false });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.dispatchUpdateAvailable).not.toHaveBeenCalled();
    });
  });
});
