import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isPackaged: true,
  testMode: false,
  fetch: vi.fn(),
  updateElectronApp: vi.fn(),
  onAvailable: vi.fn(),
  showMessageBox: vi.fn(),
  confirmQuit: vi.fn(),
  quitAndInstall: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mocks.isPackaged;
    },
    getVersion: () => '1.2.3',
  },
  autoUpdater: { quitAndInstall: mocks.quitAndInstall },
  dialog: { showMessageBox: mocks.showMessageBox },
  net: { fetch: mocks.fetch },
}));
vi.mock('update-electron-app', () => ({
  updateElectronApp: mocks.updateElectronApp,
  UpdateSourceType: { ElectronPublicUpdateService: 1 },
}));
vi.mock('../documents/service', () => ({ confirmQuit: mocks.confirmQuit }));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../security', () => ({ openExternalLink: vi.fn() }));
vi.mock('../test-mode', () => ({
  getEndpoints: () => ({ githubApi: 'https://api.github.test' }),
  isTestMode: () => mocks.testMode,
}));

let startUpdates: () => void;

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

beforeEach(async () => {
  vi.resetModules();
  const updates = await import('./index');
  startUpdates = () => updates.startUpdates(mocks.onAvailable);
  vi.useFakeTimers();
  mocks.isPackaged = true;
  mocks.testMode = false;
  mocks.fetch.mockReset();
  mocks.updateElectronApp.mockClear();
  mocks.onAvailable.mockClear();
  mocks.quitAndInstall.mockClear();
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
    mocks.testMode = true;
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
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.onAvailable).toHaveBeenCalledExactlyOnceWith('1.3.0');

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mocks.onAvailable).toHaveBeenCalledOnce();

      serve([release('v1.4.0')]);
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mocks.onAvailable).toHaveBeenLastCalledWith('1.4.0');
    });

    it('says nothing when the release check fails', async () => {
      mocks.fetch.mockImplementation(async () => json({}, 500));
      startUpdates();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mocks.onAvailable).not.toHaveBeenCalled();
    });
  });
});
