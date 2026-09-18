/**
 * Native dialogs, modal to a window when there is one. Always through
 * Electron's `dialog`, so the e2e driver can answer them.
 */
import {
  dialog,
  type BrowserWindow,
  type MessageBoxOptions,
  type MessageBoxReturnValue,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';

import { t } from './i18n';
import { getWindow } from './windows';

/** A `windowId` or a window; a missing or closed window means an app-modal dialog. */
export type DialogParent = string | BrowserWindow | undefined;

function parentOf(parent: DialogParent): BrowserWindow | undefined {
  return typeof parent === 'string' ? getWindow(parent) : parent;
}

export function messageBox(
  parent: DialogParent,
  options: MessageBoxOptions,
): Promise<MessageBoxReturnValue> {
  const win = parentOf(parent);
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

/** Two buttons, `ok` and Cancel. Resolves true for `ok`. */
export async function confirm(
  parent: DialogParent,
  { ok, ...options }: Omit<MessageBoxOptions, 'buttons'> & { ok: string },
): Promise<boolean> {
  const { response } = await messageBox(parent, {
    type: 'question',
    defaultId: 0,
    ...options,
    buttons: [ok, t('cancel')],
    cancelId: 1,
    noLink: true,
  });
  return response === 0;
}

async function pick(
  parent: DialogParent,
  options: OpenDialogOptions,
): Promise<string | undefined> {
  const win = parentOf(parent);
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? undefined : result.filePaths[0];
}

export function pickFolder(
  parent: DialogParent,
  options: OpenDialogOptions,
): Promise<string | undefined> {
  return pick(parent, {
    ...options,
    properties: ['openDirectory', ...(options.properties ?? [])],
  });
}

export function pickFile(
  parent: DialogParent,
  options: OpenDialogOptions,
): Promise<string | undefined> {
  return pick(parent, {
    ...options,
    properties: ['openFile', ...(options.properties ?? [])],
  });
}

export async function pickSave(
  parent: DialogParent,
  options: SaveDialogOptions,
): Promise<string | undefined> {
  const win = parentOf(parent);
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);
  return result.canceled ? undefined : result.filePath || undefined;
}
