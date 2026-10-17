import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { settingsApi } from '../../../ipc/renderer';
import { showToast } from '../../../ui';
import { useAppState } from '../../state';

const shown = new Set<string>();

export function StorageNotices() {
  const { t } = useTranslation('settings');
  const notices = useAppState()?.storageNotices;

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
