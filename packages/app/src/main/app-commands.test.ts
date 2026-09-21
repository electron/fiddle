/** The app-level command handlers that decide where a command goes, rather than just pass it on. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandRegistry } from './commands';
import type { Services } from './services';

type CommandHandler = Parameters<CommandRegistry['register']>[1];
type CommandContext = Parameters<CommandHandler>[0];

const electron = vi.hoisted(() => ({
  focusedWindow: undefined as object | undefined,
  focusedContents: undefined as object | undefined,
  allWindows: [] as object[],
  sendActionToFirstResponder: vi.fn(),
}));
const sendWindowCommand = vi.fn();
/** The fiddle windows, by ID; any other BrowserWindow is DevTools or the gallery. */
const fiddleWindows = new Map<string, { webContents: object }>();

vi.mock('electron', () => ({
  app: { showAboutPanel: vi.fn() },
  BrowserWindow: {
    getFocusedWindow: () => electron.focusedWindow,
    getAllWindows: () => electron.allWindows,
  },
  Menu: { sendActionToFirstResponder: electron.sendActionToFirstResponder },
  shell: { openPath: vi.fn() },
  webContents: { getFocusedWebContents: () => electron.focusedContents },
}));
vi.mock('./windows', () => ({
  getWindow: (id: string | undefined) =>
    id === undefined ? undefined : fiddleWindows.get(id),
  windowIdOf: (win: object) =>
    [...fiddleWindows].find(([, candidate]) => candidate === win)?.[0],
  sendWindowCommand: (...args: unknown[]) => sendWindowCommand(...args),
}));
vi.mock('./documents/service', () => ({ withErrorDialog: vi.fn() }));
vi.mock('./log', () => ({ log: { warn: vi.fn() }, logsDir: () => undefined }));
vi.mock('./menu', () => ({}));
vi.mock('./packaging/service', () => ({ packageFiddle: vi.fn(async () => 'packaged') }));
vi.mock('./platform/diagnostics', () => ({}));
vi.mock('./security', () => ({}));
vi.mock('./window', () => ({}));

import { registerCommands } from './app-commands';
import { packageFiddle } from './packaging/service';

const W = 'window-1';
const realPlatform = process.platform;

function webContentsStub() {
  return { undo: vi.fn(), redo: vi.fn(), selectAll: vi.fn(), reload: vi.fn() };
}

function setup() {
  const handlers = new Map<string, CommandHandler>();
  const registry = {
    register: (id: string, handler: CommandHandler) => handlers.set(id, handler),
  } as unknown as CommandRegistry;
  const services = {
    hub: { updateWindow: vi.fn() },
    runs: { toggle: vi.fn(), track: vi.fn() },
    bisect: { isActive: vi.fn(() => false), stop: vi.fn() },
  };
  registerCommands(registry, services as unknown as Services);
  const run = (id: string, context: CommandContext = { windowId: W }) =>
    handlers.get(id)!(context);
  const win = { webContents: webContentsStub() };
  fiddleWindows.set(W, win);
  return { run, services, win };
}

beforeEach(() => {
  electron.focusedWindow = undefined;
  electron.focusedContents = undefined;
  electron.allWindows = [];
  electron.sendActionToFirstResponder.mockReset();
  sendWindowCommand.mockReset();
  fiddleWindows.clear();
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform });
});

describe('undo, redo and select all', () => {
  it('go to the Monaco editor of the window when its page has focus', async () => {
    const { run, win } = setup();
    electron.focusedWindow = win;
    electron.focusedContents = win.webContents;

    await run('edit.undo');

    expect(sendWindowCommand).toHaveBeenCalledExactlyOnceWith(W, 'edit.undo');
    expect(win.webContents.undo).not.toHaveBeenCalled();
  });

  it('act on another focused page, such as DevTools, the way the native roles would', async () => {
    const { run, win } = setup();
    const devTools = webContentsStub();
    electron.focusedWindow = win;
    electron.focusedContents = devTools;

    await run('edit.selectAll');

    expect(devTools.selectAll).toHaveBeenCalledOnce();
    expect(sendWindowCommand).not.toHaveBeenCalled();
  });

  it('reach a native dialog on macOS when no window has focus, and do nothing elsewhere', async () => {
    const { run } = setup();
    Object.defineProperty(process, 'platform', { value: 'linux' });
    await run('edit.redo');
    expect(electron.sendActionToFirstResponder).not.toHaveBeenCalled();

    Object.defineProperty(process, 'platform', { value: 'darwin' });
    await run('edit.redo');
    expect(electron.sendActionToFirstResponder).toHaveBeenCalledExactlyOnceWith('redo:');
    expect(sendWindowCommand).not.toHaveBeenCalled();
  });
});

describe('bisect.toggle', () => {
  it('stops a bisect that is running, and otherwise asks the window for the range', async () => {
    const { run, services } = setup();

    await run('bisect.toggle');
    expect(sendWindowCommand).toHaveBeenCalledExactlyOnceWith(W, 'bisect.toggle');

    services.bisect.isActive.mockReturnValue(true);
    await run('bisect.toggle');
    expect(services.bisect.stop).toHaveBeenCalledExactlyOnceWith(W);
    expect(sendWindowCommand).toHaveBeenCalledOnce();
  });
});

describe('view.reloadAllWindows', () => {
  it('reloads the fiddle windows and leaves other windows alone', async () => {
    const { run, win } = setup();
    const gallery = { webContents: webContentsStub() };
    electron.allWindows = [win, gallery];

    await run('view.reloadAllWindows', { windowId: undefined });

    expect(win.webContents.reload).toHaveBeenCalledOnce();
    expect(gallery.webContents.reload).not.toHaveBeenCalled();
  });
});

describe('commands that need a window', () => {
  it('do nothing from the app menu with every window closed', async () => {
    const { run, services } = setup();
    const noWindow = { windowId: undefined };

    await run('app.preferences', noWindow);
    await run('run.toggle', noWindow);
    await run('run.package', noWindow);
    expect(services.hub.updateWindow).not.toHaveBeenCalled();
    expect(services.runs.toggle).not.toHaveBeenCalled();
    expect(packageFiddle).not.toHaveBeenCalled();

    await run('app.preferences');
    await run('run.make');
    expect(services.hub.updateWindow).toHaveBeenCalledExactlyOnceWith(W, {
      view: 'settings',
    });
    expect(packageFiddle).toHaveBeenCalledExactlyOnceWith(W, 'make', services);
    expect(services.runs.track).toHaveBeenCalledOnce();
  });
});
