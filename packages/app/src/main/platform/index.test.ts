/** Platform startup: quitting on the last window, the About panel, claiming electron-fiddle://, and the first-launch offer to move to /Applications. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
  app: {
    isPackaged: true,
    on: (event: string, listener: () => void) => mocks.listeners.set(event, listener),
    quit: vi.fn(),
    getName: () => 'Electron Fiddle',
    getVersion: () => '1.2.3',
    getAppPath: () => '/nowhere',
    setAboutPanelOptions: vi.fn(),
    isDefaultProtocolClient: vi.fn(() => false),
    setAsDefaultProtocolClient: vi.fn(),
    isInApplicationsFolder: vi.fn(() => false),
    moveToApplicationsFolder: vi.fn(),
  },
  showMessageBox: vi.fn(async (_options: unknown) => ({ response: 0 })),
  testMode: false,
  stubExists: true,
  log: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock('electron', () => ({
  app: mocks.app,
  dialog: { showMessageBox: mocks.showMessageBox },
}));
vi.mock('node:fs', () => ({ default: { existsSync: () => mocks.stubExists } }));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));
vi.mock('../log', () => ({ log: mocks.log }));
vi.mock('../test-mode', () => ({ isTestMode: () => mocks.testMode }));
vi.mock('../crash/sentry', () => ({ applyCrashReportsSetting: () => undefined }));
vi.mock('../migration', () => ({ importElectronVersionsInBackground: () => undefined }));
vi.mock('../updates', () => ({ startUpdates: () => undefined }));
vi.mock('./squirrel', () => ({
  PROTOCOL: 'electron-fiddle',
  squirrelStubPath: () => 'C:\\Fiddle\\electron-fiddle.exe',
}));

import {
  offerMoveToApplications,
  registerProtocolClient,
  setupAboutPanel,
} from './index';

const realPlatform = process.platform;
const setPlatform = (value: NodeJS.Platform) =>
  Object.defineProperty(process, 'platform', { value });
const windowsStore = (value: boolean | undefined) =>
  Object.defineProperty(process, 'windowsStore', { value, configurable: true });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.app.isPackaged = true;
  mocks.testMode = false;
  mocks.stubExists = true;
  mocks.app.isDefaultProtocolClient.mockReturnValue(false);
  mocks.app.isInApplicationsFolder.mockReturnValue(false);
  mocks.showMessageBox.mockResolvedValue({ response: 0 });
  setPlatform('linux');
});
afterEach(() => {
  setPlatform(realPlatform);
  windowsStore(undefined);
});

describe('quit on last window closed', () => {
  const hub = { onChange: () => undefined, app: {} } as never;
  async function install(platform: NodeJS.Platform) {
    vi.resetModules();
    mocks.app.isPackaged = false;
    const index = await import('./index');
    index.installQuitOnLastWindowClosed(platform);
    // A listener exists, so Electron's default quit doesn't happen either.
    const closeAll = mocks.listeners.get('window-all-closed')!;
    return { finishStartup: () => index.startPlatform(hub, false), closeAll };
  }

  it('keeps the app running when the import reader closes during startup', async () => {
    const { closeAll } = await install('linux');
    closeAll();
    expect(mocks.app.quit).not.toHaveBeenCalled();
  });

  it('quits when the last window closes after startup, except on macOS', async () => {
    const linux = await install('linux');
    await linux.finishStartup();
    linux.closeAll();
    expect(mocks.app.quit).toHaveBeenCalledTimes(1);

    mocks.app.quit.mockClear();
    const mac = await install('darwin');
    await mac.finishStartup();
    mac.closeAll();
    expect(mocks.app.quit).not.toHaveBeenCalled();
  });
});

describe('setupAboutPanel', () => {
  it('lists the bundled contributors', () => {
    mocks.app.isPackaged = false;
    setupAboutPanel();
    const options = mocks.app.setAboutPanelOptions.mock.calls[0]![0] as {
      authors: string[];
      credits: string;
      website: string;
    };
    expect(options.authors).toContain('felixrieseberg');
    expect(options.credits).toBe(options.authors.join(', '));
    expect(options.website).toBe('https://electronjs.org/fiddle');
  });
});

describe('registerProtocolClient', () => {
  it('registers the packaged app, unless it already is the handler', () => {
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).toHaveBeenCalledWith('electron-fiddle');
    mocks.app.isDefaultProtocolClient.mockReturnValue(true);
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).toHaveBeenCalledOnce();
  });

  it('leaves the protocol alone in a dev build and in test mode', () => {
    mocks.app.isPackaged = false;
    registerProtocolClient();
    mocks.app.isPackaged = true;
    mocks.testMode = true;
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });

  it('registers the Squirrel stub on Windows, and nothing for a Store or portable copy', () => {
    setPlatform('win32');
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).toHaveBeenCalledWith(
      'electron-fiddle',
      'C:\\Fiddle\\electron-fiddle.exe',
    );

    mocks.app.setAsDefaultProtocolClient.mockClear();
    mocks.stubExists = false;
    registerProtocolClient();
    mocks.stubExists = true;
    windowsStore(true);
    registerProtocolClient();
    expect(mocks.app.setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });

  it('only logs when the OS refuses', () => {
    mocks.app.setAsDefaultProtocolClient.mockImplementation(() => {
      throw new Error('access denied');
    });
    expect(() => registerProtocolClient()).not.toThrow();
    expect(mocks.log.warn).toHaveBeenCalled();
  });
});

describe('offerMoveToApplications', () => {
  beforeEach(() => setPlatform('darwin'));

  it('moves the app when the user agrees, on the first launch of a packaged app outside /Applications', async () => {
    await offerMoveToApplications(true);
    expect(mocks.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ buttons: ['moveButton', 'dontMove'], cancelId: 1 }),
    );
    expect(mocks.app.moveToApplicationsFolder).toHaveBeenCalledOnce();
  });

  it('stays put when the user declines, and survives a move that fails', async () => {
    mocks.showMessageBox.mockResolvedValueOnce({ response: 1 });
    await offerMoveToApplications(true);
    expect(mocks.app.moveToApplicationsFolder).not.toHaveBeenCalled();

    mocks.app.moveToApplicationsFolder.mockImplementation(() => {
      throw new Error('not authorised');
    });
    await expect(offerMoveToApplications(true)).resolves.toBeUndefined();
    expect(mocks.log.error).toHaveBeenCalled();
  });

  it('never asks on a later launch, elsewhere than macOS, in dev, in tests, or from /Applications', async () => {
    await offerMoveToApplications(false);
    setPlatform('linux');
    await offerMoveToApplications(true);
    setPlatform('darwin');
    mocks.app.isPackaged = false;
    await offerMoveToApplications(true);
    mocks.app.isPackaged = true;
    mocks.testMode = true;
    await offerMoveToApplications(true);
    mocks.testMode = false;
    mocks.app.isInApplicationsFolder.mockReturnValue(true);
    await offerMoveToApplications(true);
    expect(mocks.showMessageBox).not.toHaveBeenCalled();
  });
});
