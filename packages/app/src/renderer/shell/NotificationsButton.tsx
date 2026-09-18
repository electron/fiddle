/**
 * The status bar's bell: a count of toasts not seen in the list yet, and a
 * popover with every toast this window showed, newest first. Actions stay usable there.
 */
import { useTranslation } from 'react-i18next';

import { useFormat } from '../../i18n/renderer';
import { Button, Icon, IconButton, Popover, PopoverTrigger, toastQueue } from '../../ui';
import styles from './Notifications.module.css';
import { toastHistory, useToastHistory, type NotificationEntry } from './notifications';

const TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

export function NotificationsButton() {
  const { t } = useTranslation('shell');
  const { entries, unseen } = useToastHistory();
  const label = unseen ? t('notificationsButton', { count: unseen }) : t('notifications');
  return (
    <PopoverTrigger
      onOpenChange={(open) => {
        if (open) toastHistory.markSeen();
      }}
    >
      <span className={styles.anchor}>
        <IconButton icon="bell" size="sm" label={label} />
        {unseen > 0 && (
          <span className={styles.count} aria-hidden="true">
            {unseen}
          </span>
        )}
      </span>
      <Popover aria-label={t('notifications')} placement="top end" width={340}>
        <div className={styles.head}>
          <h2 className={styles.title}>{t('notifications')}</h2>
          {entries.length > 0 && (
            <Button variant="ghost" size="sm" onPress={() => toastHistory.clear()}>
              {t('clearNotifications')}
            </Button>
          )}
        </div>
        {entries.length === 0 ? (
          <p className={styles.empty}>{t('noNotifications')}</p>
        ) : (
          <ol className={styles.list}>
            {entries.map((entry) => (
              <Entry key={entry.key} entry={entry} />
            ))}
          </ol>
        )}
      </Popover>
    </PopoverTrigger>
  );
}

function Entry({ entry }: { entry: NotificationEntry }) {
  const { formatDate } = useFormat();
  const { content } = entry;
  const tone = content.tone ?? 'info';
  return (
    <li className={styles.entry} data-tone={tone}>
      <Icon name={tone} className={styles.icon} />
      <div className={styles.body}>
        <div className={styles.entryTitle}>{content.title}</div>
        {content.description && <div className={styles.text}>{content.description}</div>}
        <div className={styles.meta}>
          <time dateTime={new Date(entry.time).toISOString()}>
            {formatDate(entry.time, TIME)}
          </time>
          {content.actionLabel && content.onAction && (
            <Button
              variant="link"
              onPress={() => {
                content.onAction?.();
                toastQueue.close(entry.key);
              }}
            >
              {content.actionLabel}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
