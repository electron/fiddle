import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { appPlatformApi } from '../../../ipc/renderer';
import { showToast } from '../../../ui/components/Toast';
import { useAppState } from '../../state';

/** Linux and MSIX: a toast for each newer release main finds, offering its download page. */
export function UpdateNotice() {
  const { i18n } = useTranslation();
  const version = useAppState()?.updateAvailable;
  useEffect(() => {
    if (!version) return;
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
  }, [i18n, version]);
  return null;
}
