/** Tests the about notices: crash reports are on (leading to the privacy settings), and a newer release is out. */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  version: undefined as string | undefined,
  TakeCrashReportsNotice: vi.fn(() => Promise.resolve(true)),
  OpenUpdatePage: vi.fn(() => Promise.resolve()),
  showToast: vi.fn(),
  openSettingsSection: vi.fn((_section: string, _errorTitle: string) =>
    Promise.resolve(true),
  ),
  i18n: {
    loadNamespaces: vi.fn((_ns: string) => Promise.resolve()),
    getFixedT:
      (_lng: null, ns: string) => (key: string, options?: { version?: string }) =>
        `${ns}:${key}${options?.version ? ` ${options.version}` : ''}`,
  },
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: mocks.i18n }) }));
vi.mock('../../../ipc/renderer', () => ({
  appPlatformApi: {
    TakeCrashReportsNotice: mocks.TakeCrashReportsNotice,
    OpenUpdatePage: mocks.OpenUpdatePage,
  },
}));
vi.mock('../../../ui/components/Toast', () => ({ showToast: mocks.showToast }));
vi.mock('../../state', () => ({
  useAppState: () => ({ updateAvailable: mocks.version }),
}));
vi.mock('../settings/sections', () => ({
  openSettingsSection: mocks.openSettingsSection,
}));

import { showCrashReportsNotice, UpdateNotice } from './index';

type Toast = { title: string; description: string; actionLabel: string; onAction: () => void };
const toast = (index: number) => mocks.showToast.mock.calls[index]![0] as Toast;

beforeEach(() => vi.clearAllMocks());

describe('showCrashReportsNotice', () => {
  it('shows the notice only when main says it is due, and its action opens the privacy settings', async () => {
    mocks.TakeCrashReportsNotice.mockResolvedValueOnce(false);
    await showCrashReportsNotice(mocks.i18n as never);
    expect(mocks.showToast).not.toHaveBeenCalled();

    await showCrashReportsNotice(mocks.i18n as never);
    expect(toast(0).title).toBe('about:crashNoticeTitle');
    toast(0).onAction();
    expect(mocks.openSettingsSection).toHaveBeenCalledWith(
      'privacy',
      'about:openSettingsFailed',
    );
  });
});

describe('UpdateNotice', () => {
  it('names each new version once and opens its download page', async () => {
    const { rerender } = render(<UpdateNotice />);
    expect(mocks.i18n.loadNamespaces).not.toHaveBeenCalled();
    mocks.version = '0.40.0';
    rerender(<UpdateNotice />);
    rerender(<UpdateNotice />);
    await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalledTimes(1));
    expect(toast(0).description).toBe('about:updateAvailableDescription 0.40.0');
    expect(toast(0).actionLabel).toBe('about:download');
    toast(0).onAction();
    expect(mocks.OpenUpdatePage).toHaveBeenCalledTimes(1);
    mocks.version = '0.41.0';
    rerender(<UpdateNotice />);
    await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalledTimes(2));
  });
});
