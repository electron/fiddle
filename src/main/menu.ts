import { app, shell, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import * as defaultMenu from 'electron-default-menu';

import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';
import { showOpenDialog } from './files';

/**
 * Is the passed object a constructor for an Electron Menu?
 *
 * @param {(Array<Electron.MenuItemConstructorOptions> | Electron.Menu)} [submenu]
 * @returns {submenu is Array<Electron.MenuItemConstructorOptions>}
 */
function isSubmenu(
  submenu?: Array<MenuItemConstructorOptions> | Menu
): submenu is Array<MenuItemConstructorOptions> {
  return !!submenu && Array.isArray(submenu);
}

/**
 * Returns additional items for the help menu
 *
 * @returns {Array<Electron.MenuItemConstructorOptions>}
 */
function getHelpItems(): Array<MenuItemConstructorOptions> {
  return [
    {
      type: 'separator'
    },
    {
      label: 'Toggle Developer Tools',
      accelerator: 'CmdOrCtrl+Option+i',
      click() {
        const browserWindow = BrowserWindow.getFocusedWindow();

        if (browserWindow && !browserWindow.isDestroyed()) {
          browserWindow.webContents.openDevTools({ mode: 'bottom' });
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Open Fiddle Repository...',
      click() {
        shell.openExternal('https://github.com/electron/fiddle');
      }
    },
    {
      label: 'Open Electron Repository...',
      click() {
        shell.openExternal('https://github.com/electron/electron');
      }
    },
    {
      label: 'Open Electron Issue Tracker...',
      click() {
        shell.openExternal('https://github.com/electron/electron/issues');
      }
    },
  ];
}

/**
 * Depending on the OS, the `Preferences` either go into the `Fiddle`
 * menu (macOS) or under `File` (Linux, Windows)
 *
 * @returns {Array<Electron.MenuItemConstructorOptions>}
 */
function getPreferencesItems(): Array<MenuItemConstructorOptions> {
  return [
    {
      type: 'separator'
    }, {
      label: 'Preferences',
      accelerator: 'CmdOrCtrl+,',
      click() {
        ipcMainManager.send(IpcEvents.OPEN_SETTINGS);
      }
    }, {
      type: 'separator'
    }
  ];
}

/**
 * Returns the Exit items
 *
 * @returns {Array<Electron.MenuItemConstructorOptions>}
 */
function getQuitItems(): Array<MenuItemConstructorOptions> {
  return [
    {
      type: 'separator'
    }, {
      label: 'Exit',
      accelerator: 'Ctrl+Q,',
      click: app.quit
    }
  ];
}

/**
 * Returns the top-level "File" menu
 *
 * @returns {Array<Electron.MenuItemConstructorOptions>}
 */
function getFileMenu(): MenuItemConstructorOptions {
  const fileMenu: Array<MenuItemConstructorOptions> = [
    {
      label: 'New Fiddle',
      click: () => ipcMainManager.send(IpcEvents.FS_NEW_FIDDLE)
    }, {
      type: 'separator'
    },
    {
      label: 'Open',
      click: showOpenDialog,
      accelerator: 'CmdOrCtrl+O'
    },
    {
      type: 'separator'
    },
    {
      label: 'Save',
      click: () => ipcMainManager.send(IpcEvents.FS_SAVE_FIDDLE),
      accelerator: 'CmdOrCtrl+S'
    },
    {
      label: 'Save as',
      click: () => ipcMainManager.send(IpcEvents.FS_SAVE_FIDDLE_AS),
      accelerator: 'CmdOrCtrl+Shift+S'
    },
    {
      label: 'Save to Gist',
      click: () => ipcMainManager.send(IpcEvents.FS_SAVE_FIDDLE_GIST),
    },
  ];

  // macOS has these items in the "Fiddle" menu
  if (process.platform !== 'darwin') {
    fileMenu.splice(fileMenu.length, 0, ...getPreferencesItems(), ...getQuitItems());
  }

  return {
    label: 'File',
    submenu: fileMenu
  };
}

/**
 * Creates the app's window menu.
 */
export function setupMenu() {
  // Get template for default menu
  const menu = (defaultMenu(app, shell) as Array<MenuItemConstructorOptions>)
    .map((item) => {
      const { label } = item;

      // Append the "Settings" item
      if (
        process.platform === 'darwin'
        && label === app.getName()
        && isSubmenu(item.submenu)
      ) {
        item.submenu.splice(0, 0, ...getPreferencesItems());
      }

      // Remove "Toggle Developer Tools"
      if (label === 'View' && isSubmenu(item.submenu)) {
        item.submenu = item.submenu.filter((subItem) => subItem.label !== 'Toggle Developer Tools');
      }

      // Append items to "Help"
      if (label === 'Help' && isSubmenu(item.submenu)) {
        item.submenu = getHelpItems();
      }

      return item;
    });

  menu.splice(
    process.platform === 'darwin' ? 1 : 0,
    0,
    getFileMenu()
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}
