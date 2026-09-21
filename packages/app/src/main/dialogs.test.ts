/** Native dialogs: the confirm buttons, and the pickers' parent window and cancel results. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  dialog: {
    showMessageBox: vi.fn(async (..._args: unknown[]) => ({
      response: 1,
      checkboxChecked: false,
    })),
    showOpenDialog: vi.fn(async (..._args: unknown[]) => ({
      canceled: false,
      filePaths: ['/picked/one', '/picked/two'],
    })),
    showSaveDialog: vi.fn(async (..._args: unknown[]) => ({
      canceled: false,
      filePath: '/saved/fiddle',
    })),
  },
}));
const windows = vi.hoisted(() => ({ open: new Map<string, unknown>() }));

vi.mock('electron', () => electron);
vi.mock('./i18n', () => ({ t: (key: string) => key }));
vi.mock('./windows', () => ({ getWindow: (id: string) => windows.open.get(id) }));

import { confirm, messageBox, pickFile, pickFolder, pickSave } from './dialogs';

const { showMessageBox, showOpenDialog, showSaveDialog } = electron.dialog;

beforeEach(() => {
  showMessageBox.mockClear();
  showOpenDialog.mockClear();
  showSaveDialog.mockClear();
  windows.open.clear();
});

describe('confirm', () => {
  it('makes Enter choose the ok button unless a caller asks for Cancel', async () => {
    await confirm(undefined, { message: 'Open?', ok: 'Open' });
    expect(showMessageBox).toHaveBeenLastCalledWith(
      expect.objectContaining({ buttons: ['Open', 'cancel'], defaultId: 0, cancelId: 1 }),
    );
    await confirm(undefined, { message: 'Discard?', ok: 'Discard', defaultId: 1 });
    expect(showMessageBox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        buttons: ['Discard', 'cancel'],
        defaultId: 1,
        cancelId: 1,
      }),
    );
  });

  it('resolves true only for the ok button', async () => {
    expect(await confirm(undefined, { message: 'x', ok: 'OK' })).toBe(false);
    showMessageBox.mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await confirm(undefined, { message: 'x', ok: 'OK' })).toBe(true);
  });
});

describe('parent window', () => {
  it('is the open window with that ID; a closed or missing one makes the dialog app-modal', async () => {
    const win = { id: 1 };
    windows.open.set('w', win);
    await messageBox('w', { message: 'hi' });
    expect(showMessageBox).toHaveBeenLastCalledWith(win, { message: 'hi', noLink: true });
    await messageBox('gone', { message: 'hi' });
    expect(showMessageBox).toHaveBeenLastCalledWith({ message: 'hi', noLink: true });
    await pickFolder(win as never, { title: 'Add' });
    expect(showOpenDialog).toHaveBeenLastCalledWith(win, expect.anything());
    await pickSave('w', { title: 'Save' });
    expect(showSaveDialog).toHaveBeenLastCalledWith(win, { title: 'Save' });
    await pickSave(undefined, { title: 'Save' });
    expect(showSaveDialog).toHaveBeenLastCalledWith({ title: 'Save' });
  });
});

describe('pickers', () => {
  it('ask for a folder or a file, keeping extra properties, and return the first choice', async () => {
    expect(
      await pickFolder(undefined, { title: 'Add', properties: ['showHiddenFiles'] }),
    ).toBe('/picked/one');
    expect(showOpenDialog).toHaveBeenLastCalledWith({
      title: 'Add',
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    expect(await pickFile(undefined, { title: 'Import' })).toBe('/picked/one');
    expect(showOpenDialog).toHaveBeenLastCalledWith({
      title: 'Import',
      properties: ['openFile'],
    });
    expect(await pickSave(undefined, {})).toBe('/saved/fiddle');
  });

  it('return undefined when the user cancels or names nothing', async () => {
    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: ['/x'] });
    expect(await pickFolder(undefined, {})).toBeUndefined();
    showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: '/x' });
    expect(await pickSave(undefined, {})).toBeUndefined();
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: '' });
    expect(await pickSave(undefined, {})).toBeUndefined();
  });
});
