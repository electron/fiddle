/** Tests the toast that offers a newer Fiddle release for download. */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  version: undefined as string | undefined,
  OpenUpdatePage: vi.fn(() => Promise.resolve()),
  showToast: vi.fn(),
  i18n: {
    loadNamespaces: vi.fn((_ns: string) => Promise.resolve()),
    getFixedT:
      (_lng: null, ns: string) => (key: string, options?: { version?: string }) =>
        `${ns}:${key}${options?.version ? ` ${options.version}` : ''}`,
  },
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: mocks.i18n }) }));
vi.mock('../../../ipc/renderer', () => ({
  appPlatformApi: { OpenUpdatePage: mocks.OpenUpdatePage },
}));
vi.mock('../../../ui/components/Toast', () => ({ showToast: mocks.showToast }));
vi.mock('../../state', () => ({
  useAppState: () => ({ updateAvailable: mocks.version }),
}));

import { UpdateNotice } from './UpdateNotice';

describe('UpdateNotice', () => {
  it('names each new version once and opens its download page', async () => {
    const { rerender } = render(<UpdateNotice />);
    expect(mocks.i18n.loadNamespaces).not.toHaveBeenCalled();
    mocks.version = '0.40.0';
    rerender(<UpdateNotice />);
    rerender(<UpdateNotice />);
    await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalledTimes(1));
    const toast = mocks.showToast.mock.calls[0]![0] as {
      description: string;
      actionLabel: string;
      onAction: () => void;
    };
    expect(toast.description).toBe('about:updateAvailableDescription 0.40.0');
    expect(toast.actionLabel).toBe('about:download');
    toast.onAction();
    expect(mocks.OpenUpdatePage).toHaveBeenCalledTimes(1);
    mocks.version = '0.41.0';
    rerender(<UpdateNotice />);
    await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalledTimes(2));
  });
});
