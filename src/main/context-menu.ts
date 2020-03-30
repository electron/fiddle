import { BrowserWindow, ContextMenuParams, Menu, MenuItemConstructorOptions } from 'electron';
import { IpcEvents } from '../ipc-events';
import { isDevMode } from '../utils/devmode';
import { ipcMainManager } from './ipc';

/**
 * Returns items related to running the current fiddle.
 *
 * @returns {Array<MenuItemConstructorOptions>}
 */
export function getRunItems(): Array<MenuItemConstructorOptions> {
  return [
    {
      id: 'run',
      label: 'Run Fiddle',
      click: () => ipcMainManager.send(IpcEvents.FIDDLE_RUN)
    },
    {
      id: 'clear_console',
      label: 'Clear Console',
      click: () => ipcMainManager.send(IpcEvents.CLEAR_CONSOLE)
    },
    {
      type: 'separator'
    }
  ];
}

/**
 * Possibly returns items interacting with the Monaco editor.
 * Our check for "are we in the Monaco editor" is pretty crude -
 * we just assume that we are if we can paste text.
 *
 * @param {BrowserWindow} browserWindow
 * @param {ContextMenuParams} { x, y }
 * @returns {Array<MenuItemConstructorOptions>}
 */
export function getMonacoItems(
  { pageURL, editFlags }: ContextMenuParams
): Array<MenuItemConstructorOptions> {
  if (!editFlags.canPaste || !/.*index\.html(#?)$/.test(pageURL || '')) {
    return [];
  }

  return [
    {
      id: 'go_to_definition',
      label: 'Go to Definition',
      click() {
        const cmd = [ 'editor.action.goToDeclaration' ];
        ipcMainManager.send(IpcEvents.MONACO_EXECUTE_COMMAND, cmd);
      }
    },
    {
      id: 'peek_definition',
      label: 'Peek Definition',
      click() {
        const cmd = [ 'editor.action.previewDeclaration' ];
        ipcMainManager.send(IpcEvents.MONACO_EXECUTE_COMMAND, cmd);
      }
    },
    {
      id: 'references',
      label: 'Find References',
      click() {
        const cmd = [ 'editor.action.referenceSearch.trigger' ];
        ipcMainManager.send(IpcEvents.MONACO_EXECUTE_COMMAND, cmd);
      }
    },
    { type: 'separator' },
    {
      id: 'palette',
      label: 'Command Palette',
      click() {
        const cmd = [ 'editor.action.quickCommand' ];
        ipcMainManager.send(IpcEvents.MONACO_EXECUTE_COMMAND, cmd);
      }
    },
    { type: 'separator' },
    {
      id: 'format_document',
      label: 'Format Document',
      click() {
        const cmd = [ 'editor.action.formatDocument' ];
        ipcMainManager.send(IpcEvents.MONACO_EXECUTE_COMMAND, cmd);
      }
    },
    {
      id: 'format_selection',
      label: 'Format Selection',
      click() {
        const cmd = [ 'editor.action.formatSelection' ];
        ipcMainManager.send(IpcEvents.MONACO_EXECUTE_COMMAND, cmd);
      }
    },
    { type: 'separator' },
  ];
}

/**
 * Possibly returns the `Inspect Element` item.
 *
 * @param {BrowserWindow} browserWindow
 * @param {ContextMenuParams} { x, y }
 * @returns {Array<MenuItemConstructorOptions>}
 */
export function getInspectItems(
  browserWindow: BrowserWindow, { x, y }: ContextMenuParams
): Array<MenuItemConstructorOptions> {
  if (!isDevMode()) return [];

  return [{
    id: 'inspect',
    label: 'Inspect Element',
    click: () => {
      browserWindow.webContents.inspectElement(x, y);

      try {
        if (browserWindow.webContents.isDevToolsOpened()) {
          browserWindow.webContents.devToolsWebContents.focus();
        }
      } catch (error) {
        console.warn(`Tried to focus dev tools, but failed`, { error });
      }
    }
  }];
}

/**
 * Creates a context menu for a given BrowserWindow
 *
 * @param {BrowserWindow} browserWindow
 */
export function createContextMenu(browserWindow: BrowserWindow) {
  browserWindow.webContents.on('context-menu', (_event, props) => {
    const { editFlags } = props;

    const template: Array<MenuItemConstructorOptions> = [
      ...getRunItems(),
      ...getMonacoItems(props),
      {
        id: 'cut',
        label: 'Cut',
        role: 'cut',
        enabled: editFlags.canCut
      }, {
        id: 'copy',
        label: 'Copy',
        role: 'copy',
        enabled: editFlags.canCopy
      }, {
        id: 'paste',
        label: 'Paste',
        role: 'paste',
        enabled: editFlags.canPaste
      }, {
        type: 'separator'
      },
      ...getInspectItems(browserWindow, props)
    ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({});
  });
}
