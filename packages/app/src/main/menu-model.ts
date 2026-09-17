/**
 * The application menu as data, for the title bar's menu bar on Windows and
 * Linux (REQUIREMENTS §17.14, `Window.menuBar`): the native template of
 * src/main/menu.ts serialized to `MenuNode`s, and the lookup and role table
 * `Window.ActivateMenuItem` uses to do what the native item does.
 */
import { app, Menu, type BaseWindow, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';

import { formatAccelerator } from '../shared/accelerators';
import { ErrorCode, FiddleError } from '../shared/errors';
import type { MenuNode, Platform } from '../shared/stores';
import { testMenuBar } from './test-mode';

type Item = MenuItemConstructorOptions;
type Role = NonNullable<Item['role']>;

/**
 * Whether app windows draw the menu bar in their title bar at launch: always on
 * Windows (the title bar is ours) and Linux (the native menu bar is hidden),
 * never on macOS, which has the OS menu bar, except when a test
 * (`FIDDLE_TEST_MENUBAR=1`) or a dev run (`FIDDLE_DEV_MENUBAR=1 yarn start`)
 * forces it. The Develop menu's toggle flips it from there while the app runs
 * (`toggleWindowMenuBar` in ./menu.ts).
 */
export function hasWindowMenuBar(platform: Platform): boolean {
  if (platform !== 'darwin' || testMenuBar()) return true;
  return import.meta.env.MODE !== 'production' && !app.isPackaged && process.env.FIDDLE_DEV_MENUBAR === '1';
}

/**
 * The key Electron gives a role item that has no accelerator of its own
 * (lib/browser/api/menu-item-roles.ts), so the model shows what the native
 * menu shows.
 */
export function roleAccelerator(role: Role, platform: Platform): string | undefined {
  const mac = platform === 'darwin';
  switch (role) {
    case 'undo':
      return 'CommandOrControl+Z';
    case 'redo':
      return mac ? 'Shift+CommandOrControl+Z' : 'Control+Y';
    case 'cut':
      return 'CommandOrControl+X';
    case 'copy':
      return 'CommandOrControl+C';
    case 'paste':
      return 'CommandOrControl+V';
    case 'pasteAndMatchStyle':
      return mac ? 'Cmd+Option+Shift+V' : 'Shift+CommandOrControl+V';
    case 'selectAll':
      return 'CommandOrControl+A';
    case 'minimize':
      return 'CommandOrControl+M';
    case 'close':
      return 'CommandOrControl+W';
    case 'quit':
      return platform === 'win32' ? undefined : 'CommandOrControl+Q';
    case 'reload':
      return 'CmdOrCtrl+R';
    case 'forceReload':
      return 'Shift+CmdOrCtrl+R';
    case 'toggleDevTools':
      return mac ? 'Alt+Command+I' : 'Ctrl+Shift+I';
    case 'resetZoom':
      return 'CommandOrControl+0';
    case 'zoomIn':
      return 'CommandOrControl+Plus';
    case 'zoomOut':
      return 'CommandOrControl+-';
    case 'togglefullscreen':
      return mac ? 'Control+Command+F' : 'F11';
    case 'hide':
      return 'Command+H';
    case 'hideOthers':
      return 'Command+Alt+H';
    default:
      return undefined;
  }
}

/**
 * The template as the renderer draws it. Every item but separators needs an
 * `id` (menu.ts gives each one); hidden items are dropped, and accelerators
 * become display text for the platform.
 */
export function toMenuModel(template: readonly Item[], platform: Platform): MenuNode[] {
  return template.flatMap((item): MenuNode[] => {
    if (item.type === 'separator') return [{ kind: 'separator' }];
    if (item.visible === false) return [];
    const id = item.id;
    if (!id) throw new FiddleError(ErrorCode.internal, `Menu item "${item.label ?? item.role ?? '?'}" has no id`);
    const label = item.label ?? '';
    const enabled = item.enabled !== false;
    if (Array.isArray(item.submenu)) {
      return [{ kind: 'submenu', id, label, enabled, children: toMenuModel(item.submenu, platform) }];
    }
    const accelerator = item.accelerator ?? (item.role ? roleAccelerator(item.role, platform) : undefined);
    const node: MenuNode = { kind: 'item', id, label, enabled };
    if (item.type === 'checkbox' || item.type === 'radio') node.checked = item.checked === true;
    const text = formatAccelerator(accelerator, platform);
    if (text) node.accelerator = text;
    return [node];
  });
}

/** The item with this `id`, searched depth first; undefined for separators and unknown IDs. */
export function findMenuItem(template: readonly Item[], id: string): Item | undefined {
  for (const item of template) {
    if (item.type === 'separator') continue;
    if (item.id === id) return item;
    if (Array.isArray(item.submenu)) {
      const found = findMenuItem(item.submenu, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * What Electron's roles do (menu-item-roles.ts), for the roles the Windows and
 * Linux template uses. `MenuItem.click()` runs a role itself on those
 * platforms, but not on macOS, where AppKit handles roles natively; this
 * table runs them everywhere, so a menu bar forced on macOS for tests behaves
 * the same. Editing roles act on the window's page, which has focus again by
 * the time the renderer calls `ActivateMenuItem`.
 */
const ROLE_ACTIONS: Partial<Record<Role, (win: BrowserWindow) => void>> = {
  undo: (win) => win.webContents.undo(),
  redo: (win) => win.webContents.redo(),
  cut: (win) => win.webContents.cut(),
  copy: (win) => win.webContents.copy(),
  paste: (win) => win.webContents.paste(),
  pasteAndMatchStyle: (win) => win.webContents.pasteAndMatchStyle(),
  delete: (win) => win.webContents.delete(),
  selectAll: (win) => win.webContents.selectAll(),
  minimize: (win) => win.minimize(),
  close: (win) => win.close(),
  quit: () => app.quit(),
  togglefullscreen: (win) => win.setFullScreen(!win.isFullScreen()),
  resetZoom: (win) => {
    win.webContents.zoomLevel = 0;
  },
  zoomIn: (win) => {
    win.webContents.zoomLevel += 0.5;
  },
  zoomOut: (win) => {
    win.webContents.zoomLevel -= 0.5;
  },
  reload: (win) => win.webContents.reload(),
  forceReload: (win) => win.webContents.reloadIgnoringCache(),
  toggleDevTools: (win) => win.webContents.toggleDevTools(),
};

/** Runs a role item for `win`: the table above, or else the native item's own `click`. */
export function runRole(role: Role, id: string, win: BrowserWindow): void {
  const action = ROLE_ACTIONS[role];
  if (action) {
    action(win);
    return;
  }
  const native = Menu.getApplicationMenu()?.getMenuItemById(id);
  if (!native) throw new FiddleError(ErrorCode.unavailable, `Menu role ${role} can't run here`);
  (native.click as (event: unknown, focusedWindow: BaseWindow, focusedWebContents: Electron.WebContents) => void)(
    undefined,
    win,
    win.webContents,
  );
}

/**
 * `Window.ActivateMenuItem`: does what choosing `id` in `template` does in the
 * native menu. Unknown IDs are `not-found`, disabled items and submenus
 * `forbidden`.
 */
export function activateMenuItem(template: readonly Item[], id: string, win: BrowserWindow): void {
  const item = findMenuItem(template, id);
  if (!item) throw new FiddleError(ErrorCode.notFound, `No menu item ${id}`);
  if (item.enabled === false || Array.isArray(item.submenu)) {
    throw new FiddleError(ErrorCode.forbidden, `Menu item ${id} can't be chosen`);
  }
  if (item.role) {
    runRole(item.role, id, win);
    return;
  }
  if (typeof item.click !== 'function') throw new FiddleError(ErrorCode.unavailable, `Menu item ${id} does nothing`);
  // Our click handlers only read the window (menu.ts); the item and event are the native menu's.
  item.click({} as Electron.MenuItem, win, {} as Electron.KeyboardEvent);
}
