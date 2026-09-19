import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components';
import { describe, expect, it } from 'vitest';
import { Toaster, type ToastContent } from './Toast';

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
