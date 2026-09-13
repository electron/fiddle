import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Callout.module.css';

export interface CalloutProps {
  /** default is the neutral fill, primary is accent-soft, danger is spark-soft. */
  intent?: 'default' | 'primary' | 'danger';
  title?: ReactNode;
  icon?: IconName;
  children?: ReactNode;
  /** A link or button under the text. */
  action?: ReactNode;
  className?: string;
}

/** An inline note. No border. */
export function Callout({ intent = 'default', title, icon, children, action, className }: CalloutProps) {
  const iconName = icon ?? (intent === 'danger' ? 'warning' : 'info');
  return (
    <div className={cx(styles.callout, className)} data-intent={intent}>
      <Icon name={iconName} className={styles.icon} />
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        {children && <div className={styles.text}>{children}</div>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}

export interface EmptyStateProps {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** What a panel shows when it has nothing yet: an icon, a title, a sentence and one action. */
export function EmptyState({ icon = 'code', title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      <span className={styles.emptyIcon}>
        <Icon name={icon} size={20} />
      </span>
      <div className={styles.emptyTitle}>{title}</div>
      {children && <div className={styles.emptyText}>{children}</div>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}
