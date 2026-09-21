import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Labels.module.css';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface TagProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

/** A short label, neutral by default. */
export function Tag({ tone = 'neutral', children, className }: TagProps) {
  return (
    <span className={cx(styles.badge, className)} data-tone={tone}>
      {children}
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
