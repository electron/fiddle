/**
 * Shows each storage notice (a corrupt or too-new data file, from main's
 * JSON stores) once as a toast that stays until dismissed. Mount it once per
 * window, next to the Toaster.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { settingsApi, useAppStore } from '../../../ipc/renderer';
import { showToast } from '../../../ui';

const shown = new Set<string>();

export function StorageNotices() {
  const { t } = useTranslation('settings');
  const store = useAppStore();
  const notices = store.state === 'ready' ? store.result.storageNotices : undefined;

  useEffect(() => {
    for (const notice of notices ?? []) {
      if (shown.has(notice.id)) continue;
      shown.add(notice.id);
      const kind = notice.kind === 'corrupt' ? 'corrupt' : 'newer';
      showToast({
        tone: 'warning',
        title: t(`notice.${kind}.title`, { file: notice.file }),
        description: t(`notice.${kind}.description`),
        actionLabel: t('notice.dismiss'),
        onAction: () => {
          settingsApi.DismissStorageNotice(notice.id).catch(() => undefined);
        },
      });
    }
  }, [notices, t]);

  return null;
}
