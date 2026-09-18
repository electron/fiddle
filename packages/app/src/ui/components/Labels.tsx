import type { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { cx } from '../cx';
import { Icon } from '../icons/Icon';
import styles from './Labels.module.css';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  tone?: Tone;
  /** A leading dot with a 2.5px halo. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

/** One or two words of status. */
export function Badge({ tone = 'neutral', dot, children, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, className)} data-tone={tone}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

export interface TagProps {
  tone?: Tone;
  children: ReactNode;
  /** Adds a remove button. */
  onRemove?: () => void;
  /** Accessible name for the remove button. */
  removeLabel?: string;
  className?: string;
}

/** A short label like Badge, neutral by default and optionally removable. */
export function Tag({
  tone = 'neutral',
  children,
  onRemove,
  removeLabel,
  className,
}: TagProps) {
  return (
    <span className={cx(styles.badge, styles.tag, className)} data-tone={tone}>
      {children}
      {onRemove && (
        <AriaButton className={styles.remove} aria-label={removeLabel} onPress={onRemove}>
          <Icon name="close" size={10} />
        </AriaButton>
      )}
    </span>
  );
}

export interface KbdProps {
  /** One cap per entry, such as ["⌘", "R"]. */
  keys?: string[];
  children?: ReactNode;
  className?: string;
}

export function Kbd({ keys, children, className }: KbdProps) {
  const list = keys ?? [children];
  return (
    <span className={cx(styles.kbds, className)}>
      {list.map((key, i) => (
        <kbd key={i} className={styles.kbd}>
          {key}
        </kbd>
      ))}
    </span>
  );
}

export interface InlineCodeProps {
  children: ReactNode;
  className?: string;
}

export function InlineCode({ children, className }: InlineCodeProps) {
  return <code className={cx(styles.code, className)}>{children}</code>;
}
