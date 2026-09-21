/** `bindWindowIpc`: the App and Window handlers a window gets, and its registration with the hub. */
import { beforeEach, expect, it, vi } from 'vitest';

type Handlers = Record<string, (...args: unknown[]) => unknown>;

const mocks = vi.hoisted(() => {
  const binders: string[] = [];
  return {
    handlers: {} as Record<string, Handlers>,
    dispatcher: { updateAppStore: vi.fn(), updateWindowStore: vi.fn() },
    binders,
    // Each feature binds its own interface; here they only record that they ran for this window.
    binder: (name: string) => (ctx: { windowId: string }) =>
      binders.push(`${name}:${ctx.windowId}`),
  };
});

vi.mock('electron', () => ({
  app: { getName: () => 'Electron Fiddle', getVersion: () => '1.2.3' },
}));
vi.mock('../ipc/main', () => ({
  App: 'App',
  Window: 'Window',
  implement: (iface: string, _contents: unknown, handlers: Handlers) => {
    mocks.handlers[iface] = handlers;
    return mocks.dispatcher;
  },
}));
vi.mock('./context-menu', () => ({ reportContextMenu: vi.fn() }));
vi.mock('./menu', () => ({ activateWindowMenuItem: vi.fn() }));
vi.mock('./title-bar', () => ({ titleBarDoubleClick: vi.fn() }));
vi.mock('./windows', () => ({ getWindow: vi.fn() }));
vi.mock('./documents/ipc', () => ({ bindDocumentsIpc: mocks.binder('documents') }));
vi.mock('./modules/ipc', () => ({ bindModulesIpc: mocks.binder('modules') }));
vi.mock('./ux/ipc', () => ({ bindOnboardingIpc: mocks.binder('onboarding') }));
vi.mock('./settings/ipc', () => ({ bindSettingsIpc: mocks.binder('settings') }));
vi.mock('./github/ipc', () => ({ bindGitHubIpc: mocks.binder('github') }));
vi.mock('./platform/ipc', () => ({ bindAppPlatformIpc: mocks.binder('platform') }));
vi.mock('./run/ipc', () => ({ bindRunIpc: mocks.binder('run') }));

import { bindWindowIpc } from './ipc';

const windows = new Map<string, { rev: number }>();
const hub = {
  app: { rev: 1 },
  getWindow: (id: string) => windows.get(id),
  registerWindow:
    vi.fn<
      (
        id: string,
        init: unknown,
        sink: { pushApp(state: unknown): void; pushWindow(state: unknown): void },
      ) => void
    >(),
};
const registry = { run: vi.fn(async () => true) };
const onReady = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.binders.length = 0;
  windows.clear();
  windows.set('w', { rev: 2 });
  bindWindowIpc(
    { contents: {}, windowId: 'w', services: { hub, registry } } as never,
    { fiddle: 'init' } as never,
    onReady,
  );
});

it("serves both stores' initial state, and says notFound once the window is gone", () => {
  expect(mocks.handlers.App!.getInitialAppState!()).toBe(hub.app);
  expect(mocks.handlers.Window!.getInitialWindowState!()).toEqual({ rev: 2 });
  windows.delete('w');
  expect(() => mocks.handlers.Window!.getInitialWindowState!()).toThrow(
    expect.objectContaining({ code: 'not-found' }),
  );
});

it('runs commands on behalf of its own window and reports readiness', async () => {
  await mocks.handlers.Window!.RunCommand!('run.start');
  expect(registry.run).toHaveBeenCalledWith('run.start', { windowId: 'w' });
  mocks.handlers.Window!.ReportReady!();
  expect(onReady).toHaveBeenCalledOnce();
});

it("reports the app's name and versions", () => {
  expect(mocks.handlers.App!.GetAppInfo!()).toEqual({
    name: 'Electron Fiddle',
    version: '1.2.3',
    electronVersion: process.versions.electron,
  });
});

it('binds every feature interface for the window, then registers it with the hub so store changes reach the renderer', () => {
  expect(mocks.binders).toEqual([
    'documents:w',
    'modules:w',
    'onboarding:w',
    'settings:w',
    'github:w',
    'platform:w',
    'run:w',
  ]);
  expect(hub.registerWindow).toHaveBeenCalledWith(
    'w',
    { fiddle: 'init' },
    expect.any(Object),
  );
  const sink = hub.registerWindow.mock.calls[0]![2];
  sink.pushApp({ rev: 5 });
  sink.pushWindow({ rev: 6 });
  expect(mocks.dispatcher.updateAppStore).toHaveBeenCalledWith({ rev: 5 });
  expect(mocks.dispatcher.updateWindowStore).toHaveBeenCalledWith({ rev: 6 });
});
