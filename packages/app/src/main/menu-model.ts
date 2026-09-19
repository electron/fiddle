import {
  app,
  Menu,
  type BaseWindow,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron';

import { formatAccelerator } from '../shared/accelerators';
import { ErrorCode, FiddleError } from '../shared/errors';
import type { MenuNode, Platform } from '../shared/stores';
import { testMenuBar } from './test-mode';

type Item = MenuItemConstructorOptions;
type Role = NonNullable<Item['role']>;

/**
 * Whether app windows draw the menu bar in their title bar at launch: always on
 * Windows and Linux, on macOS only when a test (`FIDDLE_TEST_MENUBAR=1`) or a
 * dev run (`FIDDLE_DEV_MENUBAR=1 yarn start`) forces it.
 */
export function hasWindowMenuBar(platform: Platform): boolean {
  if (platform !== 'darwin' || testMenuBar()) return true;
  return (
    import.meta.env.MODE !== 'production' &&
    !app.isPackaged &&
    process.env.FIDDLE_DEV_MENUBAR === '1'
  );
}

/** The key Electron gives a role item with no accelerator of its own, so the model shows what the native menu shows. */
export function roleAccelerator(role: Role, platform: Platform): string | undefined {
  switch (role) {
    case 'cut':
      return 'CommandOrControl+X';
    case 'copy':
      return 'CommandOrControl+C';
    case 'paste':
      return 'CommandOrControl+V';
    case 'minimize':
      return 'CommandOrControl+M';
    case 'quit':
      return platform === 'win32' ? undefined : 'CommandOrControl+Q';
    case 'togglefullscreen':
      return platform === 'darwin' ? 'Control+Command+F' : 'F11';
    default:
      return undefined;
  }
}

/** The template as the renderer draws it: every item but separators needs an `id`, hidden items are dropped, and accelerators become display text. */
export function toMenuModel(template: readonly Item[], platform: Platform): MenuNode[] {
  return template.flatMap((item): MenuNode[] => {
    if (item.type === 'separator') return [{ kind: 'separator' }];
    if (item.visible === false) return [];
    const id = item.id;
    if (!id)
      throw new FiddleError(
        ErrorCode.internal,
        `Menu item "${item.label ?? item.role ?? '?'}" has no id`,
      );
    const label = item.label ?? '';
    const enabled = item.enabled !== false;
    if (Array.isArray(item.submenu)) {
      return [
        {
          kind: 'submenu',
          id,
          label,
          enabled,
          children: toMenuModel(item.submenu, platform),
        },
      ];
    }
    const accelerator =
      item.accelerator ?? (item.role ? roleAccelerator(item.role, platform) : undefined);
    const node: MenuNode = { kind: 'item', id, label, enabled };
    if (item.type === 'checkbox' || item.type === 'radio')
      node.checked = item.checked === true;
    if (item.type === 'radio') node.radio = true;
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
 * What Electron's roles do, for the roles the Windows and Linux template uses.
 * `MenuItem.click()` runs a role only off macOS, so a bar forced on macOS needs
 * this table. Editing roles act on the page, which has focus again by the time
 * `ActivateMenuItem` arrives.
 */
const ROLE_ACTIONS: Partial<Record<Role, (win: BrowserWindow) => void>> = {
  cut: (win) => win.webContents.cut(),
  copy: (win) => win.webContents.copy(),
  paste: (win) => win.webContents.paste(),
  minimize: (win) => win.minimize(),
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
};

/** Runs a role item for `win`: the table above, or else the native item's own `click`. */
export function runRole(role: Role, id: string, win: BrowserWindow): void {
  const action = ROLE_ACTIONS[role];
  if (action) {
    action(win);
    return;
  }
  const native = Menu.getApplicationMenu()?.getMenuItemById(id);
  if (!native)
    throw new FiddleError(ErrorCode.unavailable, `Menu role ${role} can't run here`);
  (
    native.click as (
      event: unknown,
      focusedWindow: BaseWindow,
      focusedWebContents: Electron.WebContents,
    ) => void
  )(undefined, win, win.webContents);
}

/**
 * `Window.ActivateMenuItem`: does what choosing `id` in `template` does in the
 * native menu. Unknown IDs are `not-found`, disabled items and submenus
 * `forbidden`.
 */
export function activateMenuItem(
  template: readonly Item[],
  id: string,
  win: BrowserWindow,
): void {
  const item = findMenuItem(template, id);
  if (!item) throw new FiddleError(ErrorCode.notFound, `No menu item ${id}`);
  if (item.enabled === false || Array.isArray(item.submenu)) {
    throw new FiddleError(ErrorCode.forbidden, `Menu item ${id} can't be chosen`);
  }
  if (item.role) {
    runRole(item.role, id, win);
    return;
  }
  if (typeof item.click !== 'function')
    throw new FiddleError(ErrorCode.unavailable, `Menu item ${id} does nothing`);
  // Our click handlers only read the window, so the item and event can be empty.
  item.click({} as Electron.MenuItem, win, {} as Electron.KeyboardEvent);
}
