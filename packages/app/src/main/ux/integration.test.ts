/** OS integration: notifications and attention for finished operations, the taskbar progress bar, jump list tasks and the dock menu. */
import { EventEmitter } from 'node:events';

import type { MenuItemConstructorOptions } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RunState, VersionsState } from '../../shared/stores';

const mocks = vi.hoisted(() => ({
  notifications: [] as Array<{ options: { title: string; body: string } }>,
  notificationsSupported: true,
  focusedWindow: null as unknown,
  allWindows: [] as unknown[],
  openFolderIn: vi.fn(async (_windowId: unknown, _dir: string) => 1),
  recentFolders: vi.fn((): string[] => []),
  getWindow: vi.fn(),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class Notification extends EventEmitter {
    static isSupported = () => mocks.notificationsSupported;
    readonly options: { title: string; body: string };
    show = vi.fn();
    constructor(options: { title: string; body: string }) {
      super();
      this.options = options;
      mocks.notifications.push(this);
    }
  }
  return {
    app: Object.assign(new EventEmitter(), {
      dock: { bounce: vi.fn(), setMenu: vi.fn() },
      setJumpList: vi.fn(() => 'ok'),
    }),
    BrowserWindow: {
      getAllWindows: () => mocks.allWindows,
      getFocusedWindow: () => mocks.focusedWindow,
    },
    Menu: { buildFromTemplate: (template: unknown) => template },
    Notification,
  };
});
vi.mock('../documents/service', () => ({
  openFolderIn: mocks.openFolderIn,
  recentFolders: mocks.recentFolders,
}));
vi.mock('../i18n', () => ({
  t: (key: string) => key,
  tm: () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
}));
vi.mock('../log', () => ({ log: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('../windows', () => ({
  focusedWindowId: () => undefined,
  getWindow: mocks.getWindow,
}));

const { app } = await import('electron');
const { installOsIntegration } = await import('./integration');
const { ARG_NEW_FIDDLE, ARG_OPEN_FOLDER } = await import('./jump-list');

const realPlatform = process.platform;
const READY: RunState = {
  status: 'ready',
  task: 'run',
  errors: [],
  clearedSeq: 0,
  bisect: null,
};

function fakeWindow() {
  return Object.assign(new EventEmitter(), {
    focused: false,
    minimized: false,
    isDestroyed: () => false,
    isFocused(this: { focused: boolean }) {
      return this.focused;
    },
    isMinimized(this: { minimized: boolean }) {
      return this.minimized;
    },
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    flashFrame: vi.fn(),
    setProgressBar: vi.fn(),
  });
}

/** The hub with one window `w` showing "My fiddle", and a way to publish store changes. */
function setup(platform: NodeJS.Platform = 'linux') {
  Object.defineProperty(process, 'platform', { value: platform });
  const win = fakeWindow();
  mocks.allWindows = [win];
  mocks.getWindow.mockImplementation((id?: string) => (id === 'w' ? win : undefined));
  const listeners = new Set<
    (change: { store: 'app' } | { store: 'window'; windowId: string }) => void
  >();
  let run: RunState | undefined = READY;
  const hub = {
    app: {
      versions: undefined as VersionsState | undefined,
      settings: { notifications: true },
    },
    windowIds: ['w'],
    getWindow: (id: string) =>
      id === 'w' && hub.windowIds.includes('w')
        ? { fiddle: { name: 'My fiddle' }, run }
        : undefined,
    onChange: (
      listener: (
        change: { store: 'app' } | { store: 'window'; windowId: string },
      ) => void,
    ) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const registry = { run: vi.fn(async (_id: string, _context: unknown) => undefined) };
  installOsIntegration({ hub, registry } as never);
  const setRun = (patch: Partial<RunState> | undefined) => {
    run = patch && { ...READY, ...patch };
    for (const listener of listeners) listener({ store: 'window', windowId: 'w' });
  };
  const setVersions = (patch: Partial<VersionsState>) => {
    hub.app.versions = {
      releasesRev: 1,
      installs: {},
      localBuilds: [],
      downloadingAll: false,
      downloadAllFailed: false,
      arch: 'x64',
      ...patch,
    };
    for (const listener of listeners) listener({ store: 'app' });
  };
  return { win, hub, registry, setRun, setVersions };
}

beforeEach(() => {
  mocks.notifications.length = 0;
  mocks.notificationsSupported = true;
  mocks.focusedWindow = null;
  mocks.openFolderIn.mockClear();
  mocks.recentFolders.mockReset().mockReturnValue([]);
  vi.mocked(app.dock!.bounce).mockClear();
  vi.mocked(app.dock!.setMenu).mockClear();
  vi.mocked(app.setJumpList).mockClear();
});
afterEach(async () => {
  vi.useRealTimers();
  // Let this test's deferred menu refresh run under its own platform.
  await new Promise<void>((resolve) => setImmediate(resolve));
  app.removeAllListeners('second-instance');
  Object.defineProperty(process, 'platform', { value: realPlatform });
});

describe('finished operations', () => {
  it('notify when a package ends in a window without focus, and the click brings that window up', () => {
    const { win, setRun } = setup();
    setRun({ task: 'package', status: 'running' });
    setRun({ status: 'ready', result: 'success' });
    expect(mocks.notifications).toHaveLength(1);
    const [notification] = mocks.notifications;
    expect(notification!.options).toEqual({
      title: 'packageDone',
      body: 'notificationBody:{"name":"My fiddle"}',
    });
    expect(win.flashFrame).not.toHaveBeenCalled();

    win.minimized = true;
    (notification as unknown as EventEmitter).emit('click');
    expect(win.restore).toHaveBeenCalledOnce();
    expect(win.show).toHaveBeenCalledOnce();
    expect(win.focus).toHaveBeenCalledOnce();
  });

  it('draw attention to a failure: the taskbar flashes until focus, or the dock bounces', () => {
    const linux = setup('linux');
    linux.setRun({ task: 'make', status: 'running' });
    linux.setRun({ status: 'ready', result: 'failure' });
    expect(linux.win.flashFrame).toHaveBeenCalledWith(true);
    linux.win.emit('focus');
    expect(linux.win.flashFrame).toHaveBeenLastCalledWith(false);
    expect(mocks.notifications.at(-1)?.options.title).toBe('packageFailed');

    const mac = setup('darwin');
    mac.setRun({ task: 'make', status: 'running' });
    mac.setRun({ status: 'ready', result: 'failure' });
    expect(app.dock!.bounce).toHaveBeenCalledWith('informational');
    expect(mac.win.flashFrame).not.toHaveBeenCalled();
  });

  it('stay quiet in a focused window, with notifications off, or where the OS has none', () => {
    const { win, hub, setRun } = setup();
    win.focused = true;
    setRun({ task: 'package', status: 'running' });
    setRun({ status: 'ready', result: 'failure' });
    expect(win.flashFrame).not.toHaveBeenCalled();

    win.focused = false;
    hub.app.settings.notifications = false;
    setRun({ task: 'package', status: 'running' });
    setRun({ status: 'ready', result: 'failure' });
    expect(win.flashFrame).toHaveBeenCalledWith(true);

    hub.app.settings.notifications = true;
    mocks.notificationsSupported = false;
    setRun({ task: 'package', status: 'running' });
    setRun({ status: 'ready', result: 'success' });
    expect(mocks.notifications).toHaveLength(0);
  });

  it('notify for a run only when it took a while', () => {
    vi.useFakeTimers();
    const { setRun } = setup();
    setRun({ status: 'running' });
    vi.advanceTimersByTime(2000);
    setRun({ status: 'ready', result: 'success' });
    expect(mocks.notifications).toHaveLength(0);

    setRun({ status: 'running' });
    vi.advanceTimersByTime(10_000);
    setRun({ status: 'ready', result: 'failure' });
    expect(mocks.notifications.map((n) => n.options.title)).toEqual(['runFailed']);
  });

  it('notify when Download all ends while no window has focus', () => {
    const { setVersions } = setup();
    setVersions({ downloadingAll: true });
    setVersions({ downloadingAll: false, downloadAllFailed: true });
    expect(mocks.notifications.map((n) => n.options)).toEqual([
      { title: 'downloadsFailed', body: '' },
    ]);
    mocks.focusedWindow = {};
    setVersions({ downloadingAll: true });
    setVersions({ downloadingAll: false });
    expect(mocks.notifications).toHaveLength(1);
  });

  it('forget a window that closed, so nothing is announced in its name later', () => {
    vi.useFakeTimers();
    const { hub, setRun } = setup();
    setRun({ status: 'running' });
    vi.advanceTimersByTime(10_000);
    hub.windowIds = [];
    setRun(undefined);
    hub.windowIds = ['w'];
    setRun({ status: 'ready' });
    expect(mocks.notifications).toHaveLength(0);
  });
});

describe('taskbar progress', () => {
  it('shows the download percentage, an indeterminate bar, or none, changing the bar only when the value does', () => {
    const { win, setVersions, setRun } = setup();
    setVersions({ installs: { '30.0.0': { state: 'downloading', percent: 40 } } });
    setVersions({ installs: { '30.0.0': { state: 'downloading', percent: 40 } } });
    setRun({ status: 'ready' });
    expect(win.setProgressBar.mock.calls).toEqual([[0.4]]);

    setVersions({ downloadingAll: true });
    expect(win.setProgressBar).toHaveBeenLastCalledWith(2, { mode: 'indeterminate' });
    setVersions({});
    expect(win.setProgressBar).toHaveBeenLastCalledWith(-1);
    expect(win.setProgressBar).toHaveBeenCalledTimes(3);
  });
});

describe('second instance', () => {
  const launch = (...argv: string[]) =>
    app.emit('second-instance', {}, ['fiddle.exe', ...argv]);

  it('runs a jump list task, and opens only a folder from the recent list', () => {
    const { registry } = setup('win32');
    mocks.recentFolders.mockReturnValue(['C:\\fiddles\\one']);
    launch(ARG_NEW_FIDDLE);
    expect(registry.run).toHaveBeenCalledWith('file.newFiddle', { windowId: 'w' });

    launch(ARG_OPEN_FOLDER, 'C:\\fiddles\\one');
    expect(mocks.openFolderIn).toHaveBeenCalledWith(undefined, 'C:\\fiddles\\one');
    launch(ARG_OPEN_FOLDER, 'C:\\somewhere\\else');
    expect(mocks.openFolderIn).toHaveBeenCalledOnce();
  });

  it('leaves a deep link to Documents, even with a task argument beside it', () => {
    const { registry } = setup('win32');
    launch('electron-fiddle://gist/abc', ARG_NEW_FIDDLE);
    expect(registry.run).not.toHaveBeenCalled();
  });
});

describe('session menus', () => {
  /** installOsIntegration fills them on the next turn. */
  const filled = () => new Promise<void>((resolve) => setImmediate(resolve));

  it('lists New window, New fiddle and the recent folders in the macOS dock menu, refreshed as the list changes', async () => {
    mocks.recentFolders.mockReturnValue(['/fiddles/one']);
    const { registry, setRun } = setup('darwin');
    await filled();
    const menu = vi.mocked(app.dock!.setMenu).mock
      .calls[0]![0] as unknown as MenuItemConstructorOptions[];
    expect(menu.map((item) => item.label ?? item.type)).toEqual([
      'newWindow',
      'newFiddle',
      'separator',
      'one',
    ]);
    (menu[0]!.click as () => void)();
    expect(registry.run).toHaveBeenCalledWith('app.newWindow', { windowId: 'w' });
    (menu[3]!.click as () => void)();
    expect(mocks.openFolderIn).toHaveBeenCalledWith(undefined, '/fiddles/one');

    setRun({ status: 'ready' });
    expect(app.dock!.setMenu).toHaveBeenCalledOnce();
    mocks.recentFolders.mockReturnValue([]);
    setRun({ status: 'ready' });
    expect(app.dock!.setMenu).toHaveBeenCalledTimes(2);
  });

  it('puts the tasks and the recent folders in the Windows jump list', async () => {
    mocks.recentFolders.mockReturnValue(['C:\\fiddles\\one']);
    setup('win32');
    await filled();
    const categories = vi.mocked(app.setJumpList).mock.calls[0]![0]!;
    expect(categories[0]).toMatchObject({
      type: 'tasks',
      items: [{ title: 'newWindow' }, { title: 'newFiddle', args: ARG_NEW_FIDDLE }],
    });
    expect(categories[1]).toMatchObject({
      type: 'custom',
      name: 'recent',
      items: [
        {
          args: `${ARG_OPEN_FOLDER} "C:\\fiddles\\one"`,
          description: 'C:\\fiddles\\one',
        },
      ],
    });
  });

  it('has neither on Linux', async () => {
    setup('linux');
    await filled();
    expect(app.setJumpList).not.toHaveBeenCalled();
    expect(app.dock!.setMenu).not.toHaveBeenCalled();
  });
});
