import { app, shell, Menu, BrowserWindow } from 'electron';
import * as defaultMenu from 'electron-default-menu';

import { IpcEvents } from '../ipc-events';
import { ipcMainManager } from './ipc';

/**
 * Is the passed object a constructor for an Electron Menu?
 *
 * @param {(Array<Electron.MenuItemConstructorOptions> | Electron.Menu)} [submenu]
 * @returns {submenu is Array<Electron.MenuItemConstructorOptions>}
 */
function isSubmenu(
  submenu?: Array<Electron.MenuItemConstructorOptions> | Electron.Menu
): submenu is Array<Electron.MenuItemConstructorOptions> {
  return !!submenu && Array.isArray(submenu);
}

/**
 * Returns additional items for the help menu
 *
 * @returns {Array<Electron.MenuItemConstructorOptions>}
 */
function getHelpItems(): Array<Electron.MenuItemConstructorOptions> {
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
 * Creates the app's window menu.
 */
export function setupMenu() {
  // Get template for default menu
  const menu = defaultMenu(app, shell)
    .map((item) => {
      const { label } = item;

      // Append the "Settings" item
      if (label === app.getName() && isSubmenu(item.submenu)) {
        item.submenu.splice(1, 0, {
          type: 'separator'
        }, {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click() {
            ipcMainManager.send(IpcEvents.OPEN_SETTINGS);
          }
        }, {
          type: 'separator'
        });
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

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}
