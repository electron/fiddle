import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { confirmDialog, DialogHost, promptDialog } from './Dialog';

function escape() {
  const target = document.activeElement!;
  fireEvent.keyDown(target, { key: 'Escape' });
  fireEvent.keyUp(target, { key: 'Escape' });
}

describe('confirmDialog', () => {
  const ask = () => {
    render(<DialogHost />);
    let result!: Promise<boolean>;
    act(() => {
      result = confirmDialog({
        title: 'Delete main.js?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });
    });
    return result;
  };

  it('resolves true when confirmed', async () => {
    const result = ask();
    expect(
      await screen.findByRole('alertdialog', { name: 'Delete main.js?' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await expect(result).resolves.toBe(true);
  });

  it('announces its message as the description', async () => {
    void ask();
    const dialog = await screen.findByRole('alertdialog');
    const id = dialog.getAttribute('aria-describedby');
    expect(id && document.getElementById(id)?.textContent).toBe('This cannot be undone.');
  });

  it('starts on Cancel when the action destroys something, so a stray Enter keeps it', async () => {
    const result = ask();
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.click(cancel);
    await expect(result).resolves.toBe(false);
  });

  it('cancels on Escape', async () => {
    const result = ask();
    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    escape();
    await expect(result).resolves.toBe(false);
  });
});

describe('promptDialog', () => {
  const ask = (defaultValue?: string) => {
    render(<DialogHost />);
    let result!: Promise<string | null>;
    act(() => {
      result = promptDialog({
        title: 'Name this fiddle',
        label: 'Name',
        defaultValue,
        confirmLabel: 'Save',
        cancelLabel: 'Cancel',
      });
    });
    return result;
  };

  it('returns the typed value', async () => {
    const result = ask('untitled');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Name' }), {
      target: { value: 'window-vibrancy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await expect(result).resolves.toBe('window-vibrancy');
  });

  it('returns null when cancelled', async () => {
    const result = ask();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await expect(result).resolves.toBeNull();
  });

  it('resolves with the value when the form is submitted, as Enter in the field does', async () => {
    const result = ask('untitled');
    const field = await screen.findByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'renamed' } });
    fireEvent.submit(field.closest('form')!);
    await expect(result).resolves.toBe('renamed');
  });

  it('gives focus back to what opened it once the prompt is gone', async () => {
    render(
      <>
        <button type="button">Opener</button>
        <DialogHost />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Opener' });
    act(() => opener.focus());
    let result!: Promise<string | null>;
    act(() => {
      result = promptDialog({
        title: 'Name this fiddle',
        label: 'Name',
        confirmLabel: 'Save',
        cancelLabel: 'Cancel',
      });
    });
    const field = await screen.findByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(document.activeElement).toBe(field));
    fireEvent.submit(field.closest('form')!);
    await expect(result).resolves.toBe('');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('shows a replacing prompt its own default, even under the same title', async () => {
    render(<DialogHost />);
    let first!: Promise<string | null>;
    act(() => {
      first = promptDialog({
        title: 'New file',
        label: 'File name',
        defaultValue: 'a.js',
        confirmLabel: 'Add',
        cancelLabel: 'Cancel',
      });
    });
    fireEvent.change(await screen.findByRole('textbox', { name: 'File name' }), {
      target: { value: 'typed.js' },
    });
    let second!: Promise<string | null>;
    act(() => {
      second = promptDialog({
        title: 'New file',
        label: 'File name',
        defaultValue: 'b.js',
        confirmLabel: 'Add',
        cancelLabel: 'Cancel',
      });
    });
    await expect(first).resolves.toBeNull();
    expect(
      (screen.getByRole('textbox', { name: 'File name' }) as HTMLInputElement).value,
    ).toBe('b.js');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(second).resolves.toBeNull();
  });
});
