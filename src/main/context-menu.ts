import { Menu, MenuItemConstructorOptions, BrowserWindow, ContextMenuParams } from 'electron';
import { ipcMainManager } from './ipc';
import { IpcEvents } from '../ipc-events';
import { isDevMode } from '../utils/devmode';

// Items related to running the current Fiddle
const runItems: Array<MenuItemConstructorOptions> = [
  {
    id: 'run',
    label: 'Run Fiddle',
    click: () => ipcMainManager.send(IpcEvents.FIDDLE_RUN)
  }
];

/**
 * Possibly returns items interacting with the Monaco editor.
 * Our check for "are we in the Monaco editor" is pretty crude -
 * we just assume that we are if we can paste text.
 *
 * @param {BrowserWindow} browserWindow
 * @param {ContextMenuParams} { x, y }
 * @returns {Array<MenuItemConstructorOptions>}
 */
function getMonacoItems(
  { editFlags }: ContextMenuParams
): Array<MenuItemConstructorOptions> {
  if (!editFlags.canPaste) return [];

  return [
    { type: 'separator' },
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
    }
  ];
}

/**
 * Possibly returns the `Inspect Element` item.
 *
 * @param {BrowserWindow} browserWindow
 * @param {ContextMenuParams} { x, y }
 * @returns {Array<MenuItemConstructorOptions>}
 */
function getInspectItems(
  browserWindow: BrowserWindow, { x, y }: ContextMenuParams
): Array<MenuItemConstructorOptions> {
  if (!isDevMode) return [];

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
  browserWindow.webContents.on('context-menu', (event, props) => {
    const { editFlags, selectionText, isEditable } = props;
    const hasText = (selectionText || '').toString().trim().length > 0;
    const template: Array<MenuItemConstructorOptions> = [
      ...runItems,
      ...getMonacoItems(props),
      { type: 'separator' },
      {
        id: 'cut',
        label: 'Cut',
        role: editFlags.canCut ? 'cut' : '',
        enabled: editFlags.canCut,
        visible: isEditable
      }, {
        id: 'copy',
        label: 'Copy',
        role: editFlags.canCopy ? 'copy' : '',
        enabled: editFlags.canCopy,
        visible: isEditable || hasText
      }, {
        id: 'paste',
        label: 'Paste',
        role: editFlags.canPaste ? 'paste' : '',
        enabled: editFlags.canPaste,
        visible: isEditable
      }, {
        type: 'separator'
      },
      ...getInspectItems(browserWindow, props)
    ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({});
  });
}
