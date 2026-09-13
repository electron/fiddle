import type { CSSProperties, ReactNode } from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { useInCapsule } from './capsule';
import { ProgressRing, Spinner } from './Progress';
import styles from './Button.module.css';

/** primary, secondary, ghost and danger, plus stop: the running Run button. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'stop';

type BaseProps = Omit<AriaButtonProps, 'children' | 'className' | 'style' | 'isPending'>;

export interface ButtonProps extends BaseProps {
  variant?: ButtonVariant;
  /** md is 30px tall, sm is 24px. */
  size?: 'md' | 'sm';
  icon?: IconName;
  iconEnd?: IconName;
  /** Key-cap hint after the label, such as "⌘R". Hidden while loading or in progress. */
  kbd?: string;
  /** Shows a spinner in place of the icon and ignores presses. Stays focusable. */
  loading?: boolean;
  /** 0 to 100. Shows a progress ring in place of the icon. */
  progress?: number;
  /** Toggled-on look (aria-pressed). */
  isPressed?: boolean;
  /** Stretch to the container's width. */
  fill?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  kbd,
  loading = false,
  progress,
  isPressed,
  fill,
  children,
  className,
  style,
  ...rest
}: ButtonProps) {
  const inCapsule = useInCapsule();
  const iconSize = size === 'sm' ? 14 : 16;
  const busy = loading || progress !== undefined;
  const lead =
    progress !== undefined ? (
      <ProgressRing value={progress} className={styles.lead} />
    ) : loading ? (
      <Spinner className={styles.lead} />
    ) : icon ? (
      <Icon name={icon} size={iconSize} className={styles.lead} />
    ) : null;

  return (
    <AriaButton
      {...rest}
      isPending={loading}
      aria-pressed={isPressed}
      className={cx(styles.button, className)}
      style={style}
      data-variant={variant}
      data-size={size}
      data-capsule={inCapsule || undefined}
      data-fill={fill || undefined}
      data-busy={busy || undefined}
    >
      {lead}
      {children != null && <span className={styles.label}>{children}</span>}
      {iconEnd && <Icon name={iconEnd} size={iconSize} />}
      {kbd && !busy && (
        <span className={styles.kbd} aria-hidden="true">
          {kbd}
        </span>
      )}
    </AriaButton>
  );
}

export interface IconButtonProps extends BaseProps {
  icon: IconName;
  /** Accessible name. Pair with a Tooltip to show it. */
  label: string;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  isPressed?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A square button with only an icon. Ghost by default. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  isPressed,
  className,
  style,
  ...rest
}: IconButtonProps) {
  const inCapsule = useInCapsule();
  return (
    <AriaButton
      {...rest}
      aria-label={label}
      aria-pressed={isPressed}
      className={cx(styles.button, styles.iconOnly, className)}
      style={style}
      data-variant={variant}
      data-size={size}
      data-capsule={inCapsule || undefined}
    >
      <Icon name={icon} />
    </AriaButton>
  );
}
