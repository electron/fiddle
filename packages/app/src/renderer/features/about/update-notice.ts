import type { i18n } from 'i18next';

import { appPlatformApi } from '../../../ipc/renderer';
import { showToast } from '../../../ui/components/Toast';

/** Main sends the event once this window is shown, so the listener goes in before anything is awaited. */
export async function listenForUpdateNotices(i18n: i18n): Promise<void> {
  appPlatformApi.onUpdateAvailable((version) => {
    void i18n.loadNamespaces('about').then(() => {
      const t = i18n.getFixedT(null, 'about');
      showToast({
        tone: 'info',
        title: t('updateAvailableTitle'),
        description: t('updateAvailableDescription', { version }),
        actionLabel: t('download'),
        onAction: () => void appPlatformApi.OpenUpdatePage(),
      });
    });
  });
  await i18n.loadNamespaces('about');
}
