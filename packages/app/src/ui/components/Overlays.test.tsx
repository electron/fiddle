import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components';
import { describe, expect, it } from 'vitest';
import { Button, IconButton } from './Button';
import { confirmDialog, DialogHost, promptDialog } from './Dialog';
import { Toaster, type ToastContent } from './Toast';
import { Tooltip } from './Tooltip';

describe('confirmDialog', () => {
  it('resolves true when confirmed', async () => {
    render(<DialogHost />);
    let result!: Promise<boolean>;
    act(() => {
      result = confirmDialog({
        title: 'Delete this fiddle?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });
    });
    expect(
      await screen.findByRole('alertdialog', { name: 'Delete this fiddle?' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await expect(result).resolves.toBe(true);
  });

  it('resolves false when cancelled', async () => {
    render(<DialogHost />);
    let result!: Promise<boolean>;
    act(() => {
      result = confirmDialog({
        title: 'Discard changes?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Keep editing' }));
    await expect(result).resolves.toBe(false);
  });
});

describe('promptDialog', () => {
  it('returns the typed value', async () => {
    render(<DialogHost />);
    let result!: Promise<string | null>;
    act(() => {
      result = promptDialog({
        title: 'Name this fiddle',
        label: 'Name',
        defaultValue: 'untitled',
        confirmLabel: 'Save',
        cancelLabel: 'Cancel',
      });
    });
    const input = await screen.findByRole('textbox', { name: 'Name' });
    fireEvent.change(input, { target: { value: 'window-vibrancy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await expect(result).resolves.toBe('window-vibrancy');
  });

  it('returns null when cancelled', async () => {
    render(<DialogHost />);
    let result!: Promise<string | null>;
    act(() => {
      result = promptDialog({
        title: 'Name this fiddle',
        label: 'Name',
        confirmLabel: 'Save',
        cancelLabel: 'Cancel',
      });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await expect(result).resolves.toBeNull();
  });
});

describe('Toaster', () => {
  it('shows queued toasts and closes them', async () => {
    const queue = new ToastQueue<ToastContent>();
    render(<Toaster closeLabel="Dismiss" aria-label="Notifications" queue={queue} />);
    act(() => {
      queue.add({
        tone: 'success',
        title: 'Published',
        description: 'gist.github.com/8f3a2c',
      });
    });
    expect(await screen.findByText('Published')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Published')).toBeNull());
  });

  it('runs a toast action and closes the toast', async () => {
    const queue = new ToastQueue<ToastContent>();
    let ran = false;
    render(<Toaster closeLabel="Dismiss" aria-label="Notifications" queue={queue} />);
    act(() => {
      queue.add({
        title: 'Electron 44.0.0-beta.3 is ready',
        actionLabel: 'Switch',
        onAction: () => (ran = true),
      });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Switch' }));
    expect(ran).toBe(true);
    await waitFor(() =>
      expect(screen.queryByText('Electron 44.0.0-beta.3 is ready')).toBeNull(),
    );
  });
});

describe('Tooltip', () => {
  it('shows its label and shortcut', () => {
    render(
      <Tooltip label="Split editor" kbd="⌘\" isOpen>
        <IconButton icon="columns" label="Split editor" />
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Split editor');
    expect(tip.textContent).toContain('⌘\\');
  });

  it('opens on keyboard focus, even for a disabled trigger', () => {
    render(
      <Tooltip label="Sign in to GitHub to publish" triggerDisabled>
        <Button isDisabled>Publish</Button>
      </Tooltip>,
    );
    const wrapper = screen.getByRole('button', { name: 'Publish' }).parentElement!;
    expect(wrapper.tabIndex).toBe(0);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => wrapper.focus());
    expect(screen.getByRole('tooltip').textContent).toContain(
      'Sign in to GitHub to publish',
    );
  });
});
