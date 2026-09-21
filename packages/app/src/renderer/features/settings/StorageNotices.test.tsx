/** Tests the toasts for data files that were corrupt or written by a newer version. */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notices: [] as { id: string; kind: 'corrupt' | 'newer-version'; file: string }[],
  showToast: vi.fn(),
  DismissStorageNotice: vi.fn((_id: string) => Promise.resolve()),
}));

vi.mock('../../../ipc/renderer', () => ({
  settingsApi: { DismissStorageNotice: mocks.DismissStorageNotice },
}));
vi.mock('../../state', () => ({
  useAppState: () => ({ storageNotices: mocks.notices }),
}));
vi.mock('../../../ui', () => ({ showToast: mocks.showToast }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { file?: string }) =>
      options?.file ? `${key} ${options.file}` : key,
  }),
}));

import { StorageNotices } from './StorageNotices';

beforeEach(() => vi.clearAllMocks());

describe('StorageNotices', () => {
  it('warns once per notice, also across renders, and dismissing tells main', () => {
    mocks.notices = [
      { id: 'n1', kind: 'corrupt', file: 'settings.json' },
      { id: 'n2', kind: 'newer-version', file: 'window-state.json' },
    ];
    const view = render(<StorageNotices />);
    expect(
      mocks.showToast.mock.calls.map(([toast]) => (toast as { title: string }).title),
    ).toEqual([
      'notice.corrupt.title settings.json',
      'notice.newer.title window-state.json',
    ]);

    mocks.notices = [
      ...mocks.notices,
      { id: 'n3', kind: 'corrupt', file: 'themes.json' },
    ];
    view.rerender(<StorageNotices />);
    expect(mocks.showToast).toHaveBeenCalledTimes(3);

    const toast = mocks.showToast.mock.calls[2]![0] as { onAction: () => void };
    toast.onAction();
    expect(mocks.DismissStorageNotice).toHaveBeenCalledWith('n3');
  });
});
