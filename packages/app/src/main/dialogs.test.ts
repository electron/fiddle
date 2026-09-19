import { beforeEach, describe, expect, it, vi } from 'vitest';

const showMessageBox = vi.hoisted(() =>
  vi.fn(async (..._args: unknown[]) => ({ response: 1, checkboxChecked: false })),
);

vi.mock('electron', () => ({ dialog: { showMessageBox } }));
vi.mock('./i18n', () => ({ t: (key: string) => key }));
vi.mock('./windows', () => ({ getWindow: () => undefined }));

import { confirm } from './dialogs';

describe('confirm', () => {
  beforeEach(() => showMessageBox.mockClear());

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
