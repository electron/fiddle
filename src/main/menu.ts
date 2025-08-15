import {
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  app,
  shell,
} from 'electron';

import {
  saveFiddle,
  saveFiddleAs,
  saveFiddleAsForgeProject,
  showOpenDialog,
} from './files';
import { ipcMainManager } from './ipc';
import { getTemplateValues } from './templates';
import { createMainWindow } from './windows';
import {
  BlockableAccelerator,
  SetUpMenuOptions,
  Templates,
} from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { SHOW_ME_TEMPLATES } from '../templates';

/**
 * Is the passed object a constructor for an Electron Menu?
 */
function isSubmenu(
  submenu?: Array<MenuItemConstructorOptions> | Menu,
): submenu is Array<MenuItemConstructorOptions> {
  return !!submenu && Array.isArray(submenu);
}

/**
 * Returns additional items for the help menu
 */
function getHelpItems(): Array<MenuItemConstructorOptions> {
  const items: MenuItemConstructorOptions[] = [];

  items.push(
    {
      type: 'separator',
    },
    {
      label: 'Show Welcome Tour',
      click() {
        ipcMainManager.send(IpcEvents.SHOW_WELCOME_TOUR);
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Toggle Developer Tools',
      accelerator: 'CmdOrCtrl+Option+i',
      click() {
        const browserWindow = BrowserWindow.getFocusedWindow();

        if (browserWindow && !browserWindow.isDestroyed()) {
          browserWindow.webContents.toggleDevTools();
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Open Fiddle Repository...',
      click() {
        shell.openExternal('https://github.com/electron/fiddle');
      },
    },
    {
      label: 'Open Electron Repository...',
      click() {
        shell.openExternal('https://github.com/electron/electron');
      },
    },
    {
      label: 'Open Electron Issue Tracker...',
      click() {
        shell.openExternal('https://github.com/electron/electron/issues');
      },
    },
  );

  // on macOS, there's already the About Electron Fiddle menu item
  // under the first submenu set by the electron-default-menu package
  if (process.platform !== 'darwin') {
    items.push(
      {
        type: 'separator',
      },
      {
        label: 'About Electron Fiddle',
        click() {
          app.showAboutPanel();
        },
      },
    );
  }

  return items;
}

/**
 * Depending on the OS, the `Preferences` either go into the `Fiddle`
 * menu (macOS) or under `File` (Linux, Windows)
 */
function getPreferencesItems(): Array<MenuItemConstructorOptions> {
  return [
    {
      type: 'separator',
    },
    {
      label: 'Preferences',
      accelerator: 'CmdOrCtrl+,',
      click() {
        ipcMainManager.send(IpcEvents.OPEN_SETTINGS);
      },
    },
    {
      type: 'separator',
    },
  ];
}

/**
 * Returns the Exit items
 */
function getQuitItems(): Array<MenuItemConstructorOptions> {
  return [
    {
      type: 'separator',
    },
    {
      role: 'quit',
    },
  ];
}

/**
 * Returns the top-level "File" menu
 */
function getTasksMenu(): MenuItemConstructorOptions {
  const tasksMenu: Array<MenuItemConstructorOptions> = [
    {
      label: 'Run Fiddle...',
      accelerator: 'F5',
      click: () => ipcMainManager.send(IpcEvents.FIDDLE_RUN),
    },
    {
      label: 'Package Fiddle...',
      click: () => ipcMainManager.send(IpcEvents.FIDDLE_PACKAGE),
    },
    {
      label: 'Make installers for Fiddle...',
      click: () => ipcMainManager.send(IpcEvents.FIDDLE_MAKE),
    },
  ];

  return {
    label: 'Tasks',
    submenu: tasksMenu,
  };
}

function getShowMeMenuItem(
  key: string,
  activeKey: string | null,
  item: string | Templates,
): MenuItemConstructorOptions {
  if (typeof item === 'string') {
    return {
      label: key,
      type: 'radio',
      checked: key === activeKey,
      click: async () => {
        const editorValues = await getTemplateValues(key);
        ipcMainManager.send(IpcEvents.FS_OPEN_TEMPLATE, [key, editorValues]);
      },
    };
  }

  return {
    label: key,
    submenu: Object.keys(item).map((subkey) => {
      return getShowMeMenuItem(subkey, activeKey, item[subkey]);
    }),
  };
}

function getShowMeMenu(
  activeTemplate: string | null,
): MenuItemConstructorOptions {
  const showMeMenu: Array<MenuItemConstructorOptions> = Object.keys(
    SHOW_ME_TEMPLATES,
  ).map((key) =>
    getShowMeMenuItem(key, activeTemplate, SHOW_ME_TEMPLATES[key]),
  );

  return {
    label: 'Show Me',
    submenu: showMeMenu,
  };
}

/**
 * Returns the top-level "File" menu
 */
function getFileMenu(
  acceleratorsToBlock: BlockableAccelerator[] = [],
): MenuItemConstructorOptions {
  const fileMenu: Array<MenuItemConstructorOptions> = [
    {
      label: 'New Fiddle',
      click: () => {
        ipcMainManager.send(IpcEvents.CLEAR_CONSOLE);
        return ipcMainManager.send(IpcEvents.FS_NEW_FIDDLE);
      },
      accelerator: 'CmdOrCtrl+N',
    },
    {
      label: 'New Test',
      click: () => {
        ipcMainManager.send(IpcEvents.CLEAR_CONSOLE);
        return ipcMainManager.send(IpcEvents.FS_NEW_TEST);
      },
      accelerator: 'CmdOrCtrl+T',
    },
    {
      label: 'New Window',
      click: () => createMainWindow(),
      accelerator: 'CmdOrCtrl+Shift+N',
    },
    {
      type: 'separator',
    },
    {
      label: 'Open',
      click() {
        const browserWindow = BrowserWindow.getFocusedWindow();

        if (browserWindow) {
          showOpenDialog(browserWindow);
        }
      },
      accelerator: 'CmdOrCtrl+O',
    },
    {
      label: 'Open Recent',
      role: 'recentDocuments',
      submenu: [
        {
          label: 'Clear Recent',
          role: 'clearRecentDocuments',
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: 'Save',
      click: () => saveFiddle(),
      accelerator: !acceleratorsToBlock.includes(BlockableAccelerator.save)
        ? 'CmdOrCtrl+S'
        : undefined,
    },
    {
      label: 'Save as',
      click: () => saveFiddleAs(),
      accelerator: !acceleratorsToBlock.includes(BlockableAccelerator.saveAs)
        ? 'CmdOrCtrl+Shift+S'
        : undefined,
    },
    {
      type: 'separator',
    },
    {
      label: 'Publish to Gist',
      click: () => ipcMainManager.send(IpcEvents.FS_SAVE_FIDDLE_GIST),
    },
    {
      label: 'Save as Forge Project',
      click: () => saveFiddleAsForgeProject(),
    },
  ];

  // macOS has these items in the "Fiddle" menu
  if (process.platform !== 'darwin') {
    fileMenu.splice(
      fileMenu.length,
      0,
      ...getPreferencesItems(),
      ...getQuitItems(),
    );
  }

  return {
    label: 'File',
    submenu: fileMenu,
  };
}

/**
 * Creates the app's window menu.
 */
export function setupMenu(options?: SetUpMenuOptions) {
  const acceleratorsToBlock = options?.acceleratorsToBlock || [];
  const activeTemplate = options?.activeTemplate || null;

  // Get template for default menu
  const defaultMenu = require('electron-default-menu');
  const menu = (
    defaultMenu(app, shell) as Array<MenuItemConstructorOptions>
  ).map((item) => {
    const { label } = item;

    // Append the "Settings" item
    if (
      process.platform === 'darwin' &&
      label === app.name &&
      isSubmenu(item.submenu)
    ) {
      item.submenu.splice(2, 0, ...getPreferencesItems());
    }

    // Custom handler for "Select All" for Monaco
    if (label === 'Edit' && isSubmenu(item.submenu)) {
      const selectAll = item.submenu.find((i) => i.label === 'Select All')!;
      delete selectAll.role; // override default role
      selectAll.click = () => {
        ipcMainManager.send(IpcEvents.SELECT_ALL_IN_EDITOR);

        // Allow selection to occur in text fields outside the editors.
        if (process.platform === 'darwin') {
          Menu.sendActionToFirstResponder('selectAll:');
        }
      };

      const undo = item.submenu.find((i) => i.label === 'Undo')!;
      delete undo.role; // override default role
      undo.click = () => {
        ipcMainManager.send(IpcEvents.UNDO_IN_EDITOR);

        // Allow undo to occur in text fields outside the editors.
        if (process.platform === 'darwin') {
          Menu.sendActionToFirstResponder('undo:');
        }
      };

      const redo = item.submenu.find((i) => i.label === 'Redo')!;
      delete redo.role; // override default role
      redo.click = () => {
        ipcMainManager.send(IpcEvents.REDO_IN_EDITOR);

        // Allow redo to occur in text fields outside the editors.
        if (process.platform === 'darwin') {
          Menu.sendActionToFirstResponder('redo:');
        }
      };
    }

    // Tweak "View" menu
    if (label === 'View' && isSubmenu(item.submenu)) {
      // remove "Reload" (has weird behaviour) and "Toggle Developer Tools"
      item.submenu = item.submenu.filter(
        (subItem) =>
          subItem.label !== 'Toggle Developer Tools' &&
          subItem.label !== 'Reload',
      );
      item.submenu.push(
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ); // Add zooming actions
      item.submenu.push(
        { type: 'separator' },
        {
          label: 'Toggle Soft Wrap',
          click: () =>
            ipcMainManager.send(IpcEvents.MONACO_TOGGLE_OPTION, ['wordWrap']),
        },
      );
      item.submenu.push(
        { type: 'separator' },
        {
          label: 'Toggle Mini Map',
          click: () =>
            ipcMainManager.send(IpcEvents.MONACO_TOGGLE_OPTION, [
              'minimap.enabled',
            ]),
        },
      );
      item.submenu.push(
        { type: 'separator' },
        {
          label: 'Toggle Bisect Helper',
          click: () => ipcMainManager.send(IpcEvents.BISECT_COMMANDS_TOGGLE),
          accelerator: 'CommandorControl+Shift+B',
        },
      );
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
    getFileMenu(acceleratorsToBlock),
  );

  menu.splice(
    menu.length - 1,
    0,
    getTasksMenu(),
    getShowMeMenu(activeTemplate),
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}
