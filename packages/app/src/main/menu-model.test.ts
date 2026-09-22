import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FiddleError } from '../shared/errors';

const electron = vi.hoisted(() => ({
  app: { isPackaged: false, quit: vi.fn() },
  Menu: { getApplicationMenu: vi.fn(() => null as unknown) },
}));
vi.mock('electron', () => electron);
const testMode = vi.hoisted(() => ({ testMenuBar: vi.fn(() => false) }));
vi.mock('./test-mode', () => testMode);

const { activateMenuItem, findMenuItem, hasWindowMenuBar, toMenuModel } =
  await import('./menu-model');

type Item = MenuItemConstructorOptions;

function fakeWindow() {
  const webContents = {
    cut: vi.fn(),
    copy: vi.fn(),
    paste: vi.fn(),
    zoomLevel: 1,
    toggleDevTools: vi.fn(),
  };
  const win = {
    webContents,
    minimize: vi.fn(),
    close: vi.fn(),
    isFullScreen: vi.fn(() => false),
    setFullScreen: vi.fn(),
  };
  return win as unknown as BrowserWindow & typeof win;
}

const newFiddle = vi.fn();
const openRecent = vi.fn();
const template: Item[] = [
  {
    id: 'menu:file',
    label: 'File',
    submenu: [
      {
        id: 'file.newFiddle',
        label: 'New fiddle',
        accelerator: 'CmdOrCtrl+N',
        click: (_item, win) => newFiddle(win),
      },
      {
        id: 'file.save',
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        enabled: false,
        click: vi.fn(),
      },
      { type: 'separator' },
      {
        id: 'menu:openRecent',
        label: 'Open recent',
        submenu: [
          { id: 'recent:0', label: '/tmp/one', click: () => openRecent('/tmp/one') },
        ],
      },
      { id: 'hidden', label: 'Hidden', visible: false, click: vi.fn() },
      { id: 'role:quit', role: 'quit', label: 'Exit' },
    ],
  },
  {
    id: 'menu:edit',
    label: 'Edit',
    submenu: [
      { id: 'role:cut', role: 'cut', label: 'Cut' },
      {
        id: 'role:zoomIn',
        role: 'zoomIn',
        label: 'Zoom in',
        accelerator: 'CmdOrCtrl+Plus',
      },
      {
        id: 'role:togglefullscreen',
        role: 'togglefullscreen',
        label: 'Enter full screen',
      },
      { id: 'role:minimize', role: 'minimize', label: 'Minimize' },
      {
        id: 'example:Menu',
        label: 'Menu',
        type: 'checkbox',
        checked: true,
        click: vi.fn(),
      },
      { id: 'role:help', role: 'help', label: 'Help' },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  testMode.testMenuBar.mockReturnValue(false);
});

describe('toMenuModel', () => {
  it('serializes submenus, items and separators, drops hidden items and formats keys for the platform', () => {
    expect(toMenuModel(template, 'win32')).toEqual([
      {
        kind: 'submenu',
        id: 'menu:file',
        label: 'File',
        enabled: true,
        children: [
          {
            kind: 'item',
            id: 'file.newFiddle',
            label: 'New fiddle',
            enabled: true,
            accelerator: 'Ctrl+N',
          },
          {
            kind: 'item',
            id: 'file.save',
            label: 'Save',
            enabled: false,
            accelerator: 'Ctrl+S',
          },
          { kind: 'separator' },
          {
            kind: 'submenu',
            id: 'menu:openRecent',
            label: 'Open recent',
            enabled: true,
            children: [
              { kind: 'item', id: 'recent:0', label: '/tmp/one', enabled: true },
            ],
          },
          { kind: 'item', id: 'role:quit', label: 'Exit', enabled: true },
        ],
      },
      {
        kind: 'submenu',
        id: 'menu:edit',
        label: 'Edit',
        enabled: true,
        children: [
          {
            kind: 'item',
            id: 'role:cut',
            label: 'Cut',
            enabled: true,
            accelerator: 'Ctrl+X',
          },
          {
            kind: 'item',
            id: 'role:zoomIn',
            label: 'Zoom in',
            enabled: true,
            accelerator: 'Ctrl++',
          },
          {
            kind: 'item',
            id: 'role:togglefullscreen',
            label: 'Enter full screen',
            enabled: true,
            accelerator: 'F11',
          },
          {
            kind: 'item',
            id: 'role:minimize',
            label: 'Minimize',
            enabled: true,
            accelerator: 'Ctrl+M',
          },
          {
            kind: 'item',
            id: 'example:Menu',
            label: 'Menu',
            enabled: true,
            checked: true,
          },
          { kind: 'item', id: 'role:help', label: 'Help', enabled: true },
        ],
      },
    ]);
    // Linux says Ctrl+Q for Quit; macOS writes symbols.
    expect(
      toMenuModel([{ id: 'role:quit', role: 'quit', label: 'Quit' }], 'linux')[0],
    ).toMatchObject({ accelerator: 'Ctrl+Q' });
    expect(
      toMenuModel(
        [{ id: 'x', label: 'X', accelerator: 'CmdOrCtrl+Shift+P' }],
        'darwin',
      )[0],
    ).toMatchObject({ accelerator: '⌘⇧P' });
  });

  it('refuses an item without an id', () => {
    expect(() => toMenuModel([{ label: 'Nameless', click: vi.fn() }], 'win32')).toThrow(
      FiddleError,
    );
  });
});

describe('findMenuItem', () => {
  it('finds items at any depth, and nothing for unknown ids', () => {
    expect(findMenuItem(template, 'recent:0')?.label).toBe('/tmp/one');
    expect(findMenuItem(template, 'menu:edit')?.label).toBe('Edit');
    expect(findMenuItem(template, 'nope')).toBeUndefined();
  });
});

describe('activateMenuItem', () => {
  it('runs a command item with the window, like a click in the native menu', () => {
    const win = fakeWindow();
    activateMenuItem(template, 'file.newFiddle', win);
    expect(newFiddle).toHaveBeenCalledWith(win);
    activateMenuItem(template, 'recent:0', win);
    expect(openRecent).toHaveBeenCalledWith('/tmp/one');
  });

  it('runs roles itself: editing on the page, window and app methods, zoom by half a level', () => {
    const win = fakeWindow();
    activateMenuItem(template, 'role:cut', win);
    expect(win.webContents.cut).toHaveBeenCalled();
    activateMenuItem(template, 'role:minimize', win);
    expect(win.minimize).toHaveBeenCalled();
    activateMenuItem(template, 'role:togglefullscreen', win);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    activateMenuItem(template, 'role:zoomIn', win);
    expect(win.webContents.zoomLevel).toBe(1.5);
    activateMenuItem(template, 'role:quit', win);
    expect(electron.app.quit).toHaveBeenCalled();
  });

  it("falls back to the native item's click for a role it doesn't know", () => {
    const win = fakeWindow();
    const click = vi.fn();
    electron.Menu.getApplicationMenu.mockReturnValueOnce({
      getMenuItemById: (id: string) => (id === 'role:help' ? { click } : null),
    });
    activateMenuItem(template, 'role:help', win);
    expect(click).toHaveBeenCalledWith(undefined, win, win.webContents);
    expect(() => activateMenuItem(template, 'role:help', win)).toThrow(
      expect.objectContaining({ code: 'unavailable' }),
    );
  });

  it('rejects unknown ids, disabled items and submenus with stable codes', () => {
    const win = fakeWindow();
    expect(() => activateMenuItem(template, 'role:about', win)).toThrow(
      expect.objectContaining({ code: 'not-found' }),
    );
    expect(() => activateMenuItem(template, 'file.save', win)).toThrow(
      expect.objectContaining({ code: 'forbidden' }),
    );
    expect(() => activateMenuItem(template, 'menu:openRecent', win)).toThrow(
      expect.objectContaining({ code: 'forbidden' }),
    );
    // A separator has no id to choose.
    expect(() => activateMenuItem(template, 'separator', win)).toThrow(FiddleError);
  });
});

describe('hasWindowMenuBar', () => {
  it('is on for Windows and Linux, and on macOS only when a test or dev run forces it', () => {
    expect(hasWindowMenuBar('win32')).toBe(true);
    expect(hasWindowMenuBar('linux')).toBe(true);
    expect(hasWindowMenuBar('darwin')).toBe(false);
    testMode.testMenuBar.mockReturnValue(true);
    expect(hasWindowMenuBar('darwin')).toBe(true);
    testMode.testMenuBar.mockReturnValue(false);
    vi.stubEnv('FIDDLE_DEV_MENUBAR', '1');
    expect(hasWindowMenuBar('darwin')).toBe(true);
    vi.unstubAllEnvs();
  });
});
