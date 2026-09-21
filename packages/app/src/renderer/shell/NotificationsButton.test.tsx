/** Tests the status bar's notifications button: the unseen count, the list of past toasts, their actions and clearing. */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));
vi.mock('../../i18n/renderer', () => ({
  useFormat: () => ({ formatDate: () => '09:41' }),
}));

import { toastQueue } from '../../ui';
import { NotificationsButton } from './NotificationsButton';
import { toastHistory } from './notifications';

const bell = () => screen.getByRole('button', { name: /^notifications/ });
const open = async () => {
  fireEvent.click(bell());
  return screen.findByRole('dialog', { name: 'notifications' });
};

afterEach(() => {
  act(() => {
    for (const toast of toastQueue.visibleToasts) toastQueue.close(toast.key);
    toastHistory.clear();
  });
});

describe('NotificationsButton', () => {
  it('counts the toasts nobody has looked at yet, until the list is opened', async () => {
    render(<NotificationsButton />);
    expect(bell().getAttribute('aria-label')).toBe('notifications');
    act(() => {
      toastQueue.add({ title: 'Saved' });
      toastQueue.add({ title: 'Published', tone: 'success' });
    });
    const button = bell();
    expect(button.getAttribute('aria-label')).toBe('notificationsButton:2');
    expect(button.parentElement?.textContent).toBe('2');
    await open();
    expect(button.getAttribute('aria-label')).toBe('notifications');
    expect(button.parentElement?.textContent).toBe('');
  });

  it('lists past toasts newest first with their time, and runs a toast’s action once, closing the toast', async () => {
    const onAction = vi.fn();
    render(<NotificationsButton />);
    act(() => {
      toastQueue.add({ title: 'Saved', description: 'to ~/fiddle' });
      toastQueue.add({
        title: 'Published',
        tone: 'success',
        actionLabel: 'Copy link',
        onAction,
      });
    });
    const dialog = await open();
    const items = within(dialog).getAllByRole('listitem');
    expect(items.map((item) => item.dataset.tone)).toEqual(['success', 'info']);
    expect(items[1]?.textContent).toContain('to ~/fiddle');
    expect(within(items[1]!).getByText('09:41').tagName).toBe('TIME');

    fireEvent.click(within(items[0]!).getByRole('button', { name: 'Copy link' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(toastQueue.visibleToasts.map((toast) => toast.content.title)).toEqual([
      'Saved',
    ]);
  });

  it('clears the list, and says so when there is nothing to show', async () => {
    render(<NotificationsButton />);
    act(() => void toastQueue.add({ title: 'Saved' }));
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: 'clearNotifications' }));
    expect(within(dialog).getByText('noNotifications')).toBeTruthy();
    expect(
      within(dialog).queryByRole('button', { name: 'clearNotifications' }),
    ).toBeNull();
  });
});
