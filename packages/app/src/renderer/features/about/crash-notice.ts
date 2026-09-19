import type { i18n } from 'i18next';

import { appPlatformApi } from '../../../ipc/renderer';
import { showToast } from '../../../ui/components/Toast';
import { openSettingsSection } from '../settings/sections';

export async function showCrashReportsNotice(i18n: i18n): Promise<void> {
  await i18n.loadNamespaces('about');
  if (!(await appPlatformApi.TakeCrashReportsNotice())) return;
  const t = i18n.getFixedT(null, 'about');
  showToast({
    tone: 'info',
    title: t('crashNoticeTitle'),
    description: t('crashNoticeDescription'),
    actionLabel: t('crashNoticeAction'),
    onAction: () => void openSettingsSection('privacy', t('openSettingsFailed')),
  });
}
