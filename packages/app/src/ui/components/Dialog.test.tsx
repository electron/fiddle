import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { confirmDialog, Dialog, DialogHost, promptDialog } from './Dialog';

function Harness({
  onOpenChange,
  isDismissable,
}: {
  onOpenChange?: (open: boolean) => void;
  isDismissable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Publish</Button>
      <Dialog
        title="Publish gist"
        closeLabel="Close"
        isOpen={open}
        isDismissable={isDismissable}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
      >
        <input aria-label="Description" />
        <Button>Publish now</Button>
      </Dialog>
    </>
  );
}

function escape() {
  const target = document.activeElement!;
  fireEvent.keyDown(target, { key: 'Escape' });
  fireEvent.keyUp(target, { key: 'Escape' });
}

/** A full press on `target`, as pointer, mouse and click events: react-aria listens to one set or the other. */
function press(target: Element) {
  fireEvent.pointerDown(target, { pointerId: 1, button: 0 });
  fireEvent.mouseDown(target, { button: 0 });
  fireEvent.pointerUp(target, { pointerId: 1, button: 0 });
  fireEvent.mouseUp(target, { button: 0 });
  fireEvent.click(target, { button: 0 });
}

async function openDialog() {
  const trigger = screen.getByRole('button', { name: 'Publish' });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'Publish gist' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return { trigger, dialog };
}

describe('Dialog', () => {
  it('takes focus when it opens and keeps Tab inside it', async () => {
    render(<Harness />);
    const { dialog } = await openDialog();
    const inside = () => dialog.contains(document.activeElement);
    for (let press = 0; press < 6; press++) {
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      expect(inside()).toBe(true);
    }
    for (let press = 0; press < 6; press++) {
      fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
      expect(inside()).toBe(true);
    }
  });

  it('closes on Escape and gives focus back to what opened it', async () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    const { trigger } = await openDialog();
    escape();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('closes on a press outside it only when dismissable', async () => {
    const { unmount } = render(<Harness isDismissable={false} />);
    const { dialog } = await openDialog();
    const scrim = dialog.parentElement!.parentElement!;
    press(scrim);
    expect(screen.queryByRole('dialog')).not.toBeNull();
    unmount();
    render(<Harness />);
    const second = await openDialog();
    const secondScrim = second.dialog.parentElement!.parentElement!;
    press(secondScrim);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('confirmDialog', () => {
  const ask = () => {
    render(<DialogHost />);
    let result!: Promise<boolean>;
    act(() => {
      result = confirmDialog({
        title: 'Delete main.js?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });
    });
    return result;
  };

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
