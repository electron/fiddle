/**
 * The non-modal "Update available" toast (REQUIREMENTS §13) for Linux and
 * MSIX, which have no auto-update. Main sends `AppPlatform.UpdateAvailable`
 * after its daily GitHub releases check.
 */
import type { i18n } from 'i18next';

import { appPlatformApi } from '../../../ipc/renderer';
import { showToast } from '../../../ui/components/Toast';

export async function listenForUpdateNotices(i18n: i18n): Promise<void> {
  await i18n.loadNamespaces('about');
  const t = i18n.getFixedT(null, 'about');
  appPlatformApi.onUpdateAvailable((version) => {
    showToast({
      tone: 'info',
      title: t('updateAvailableTitle'),
      description: t('updateAvailableDescription', { version }),
      actionLabel: t('download'),
      onAction: () => void appPlatformApi.OpenUpdatePage(),
    });
  });
}
