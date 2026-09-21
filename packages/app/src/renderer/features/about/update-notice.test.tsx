/** Tests the toast that offers a newer Fiddle release for download. */
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  onUpdateAvailable: vi.fn((listener: (version: string) => void) => {
    mocks.announce = listener;
    return () => undefined;
  }),
  announce: undefined as ((version: string) => void) | undefined,
  OpenUpdatePage: vi.fn(() => Promise.resolve()),
  showToast: vi.fn(),
}));

vi.mock('../../../ipc/renderer', () => ({
  appPlatformApi: {
    onUpdateAvailable: mocks.onUpdateAvailable,
    OpenUpdatePage: mocks.OpenUpdatePage,
  },
}));
vi.mock('../../../ui/components/Toast', () => ({ showToast: mocks.showToast }));

import { listenForUpdateNotices } from './update-notice';

const i18n = {
  loadNamespaces: vi.fn((_ns: string) => Promise.resolve()),
  getFixedT: (_lng: null, ns: string) => (key: string, options?: { version?: string }) =>
    `${ns}:${key}${options?.version ? ` ${options.version}` : ''}`,
};

describe('listenForUpdateNotices', () => {
  it('listens before it loads its strings, then names the new version and opens its download page', async () => {
    await listenForUpdateNotices(i18n as never);
    expect(mocks.onUpdateAvailable).toHaveBeenCalledTimes(1);
    mocks.announce?.('0.40.0');
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
  });
});
