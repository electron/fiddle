/** Tests the one-time notice that crash reports are on, which leads to the privacy settings. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  TakeCrashReportsNotice: vi.fn(() => Promise.resolve(true)),
  showToast: vi.fn(),
  openSettingsSection: vi.fn((_section: string, _errorTitle: string) =>
    Promise.resolve(true),
  ),
}));

vi.mock('../../../ipc/renderer', () => ({
  appPlatformApi: { TakeCrashReportsNotice: mocks.TakeCrashReportsNotice },
}));
vi.mock('../../../ui/components/Toast', () => ({ showToast: mocks.showToast }));
vi.mock('../settings/sections', () => ({
  openSettingsSection: mocks.openSettingsSection,
}));

import { showCrashReportsNotice } from './crash-notice';

const i18n = {
  loadNamespaces: (_ns: string) => Promise.resolve(),
  getFixedT: (_lng: null, ns: string) => (key: string) => `${ns}:${key}`,
};

beforeEach(() => vi.clearAllMocks());

describe('showCrashReportsNotice', () => {
  it('shows the notice only when main says it is due, and its action opens the privacy settings', async () => {
    mocks.TakeCrashReportsNotice.mockResolvedValueOnce(false);
    await showCrashReportsNotice(i18n as never);
    expect(mocks.showToast).not.toHaveBeenCalled();

    await showCrashReportsNotice(i18n as never);
    const toast = mocks.showToast.mock.calls[0]![0] as {
      title: string;
      onAction: () => void;
    };
    expect(toast.title).toBe('about:crashNoticeTitle');
    toast.onAction();
    expect(mocks.openSettingsSection).toHaveBeenCalledWith(
      'privacy',
      'about:openSettingsFailed',
    );
  });
});
