import type { CSSProperties, ReactNode } from 'react';
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { useInCapsule } from './capsule';
import { ProgressRing, Spinner } from './Progress';
import { Tooltip } from './Tooltip';
import styles from './Button.module.css';

/**
 * stop is the running Run button; link is inline accent text with an underline, such as a console location;
 * toolbar is a standalone 36px glass capsule on the chrome.
 */
export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'stop' | 'link' | 'toolbar';

export interface ButtonProps extends Omit<
  AriaButtonProps,
  'children' | 'className' | 'style' | 'isPending'
> {
  /** Secondary by default, or ghost for an icon-only button. */
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  /** Accessible name when there's no visible label. The button is then a square icon button. */
  label?: string;
  /** Shows `label` in a tooltip while the button is icon-only, with an optional shortcut. */
  tooltip?: boolean | { kbd?: string };
  /** Key-cap hint after the label, such as "⌘R". Hidden while loading or in progress. */
  kbd?: string;
  /** Shows a spinner in place of the icon and ignores presses. Stays focusable. */
  loading?: boolean;
  /** 0 to 100. Shows a progress ring in place of the icon. */
  progress?: number;
  /** Toggled-on look (aria-pressed). */
  isPressed?: boolean;
  /** Visible label. Leave out for an icon-only button named by `label`. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Button({
  variant,
  size = 'md',
  icon,
  label,
  tooltip,
  kbd,
  loading = false,
  progress,
  isPressed,
  children,
  className,
  style,
  'aria-label': ariaLabel,
  ...rest
}: ButtonProps) {
  const inCapsule = useInCapsule();
  const iconOnly = children == null;
  const busy = loading || progress !== undefined;
  // The leading icon sits 2px into the padding so the label looks centred.
  const leadClass = iconOnly ? undefined : styles.lead;
  const iconSize = size === 'sm' && !iconOnly ? 14 : 16;
  const lead =
    progress !== undefined ? (
      <ProgressRing value={progress} className={leadClass} />
    ) : loading ? (
      <Spinner className={leadClass} />
    ) : icon ? (
      <Icon name={icon} size={iconSize} className={leadClass} />
    ) : null;

  const button = (
    <AriaButton
      {...rest}
      isPending={loading}
      aria-label={ariaLabel ?? (iconOnly ? label : undefined)}
      aria-pressed={isPressed}
      className={cx(styles.button, iconOnly && styles.iconOnly, className)}
      style={style}
      data-variant={variant ?? (iconOnly ? 'ghost' : 'secondary')}
      data-size={size}
      data-capsule={inCapsule || undefined}
      data-busy={busy || undefined}
    >
      {lead}
      {!iconOnly && <span className={styles.label}>{children}</span>}
      {kbd && !busy && (
        <span className={styles.kbd} aria-hidden="true">
          {kbd}
        </span>
      )}
    </AriaButton>
  );
  if (!tooltip) return button;
  return (
    <Tooltip
      label={label}
      kbd={tooltip === true ? undefined : tooltip.kbd}
      isDisabled={!iconOnly}
    >
      {button}
    </Tooltip>
  );
}

export type IconButtonProps = Omit<ButtonProps, 'children'> & {
  icon: IconName;
  label: string;
};

/** A square button with only an icon, named by `label`. Ghost by default. */
export const IconButton = (props: IconButtonProps) => <Button {...props} />;

export type ToolbarButtonProps = Omit<ButtonProps, 'variant'> & { label: string };

/** A standalone 36px glass capsule button on the chrome. Icon-only without children. */
export const ToolbarButton = (props: ToolbarButtonProps) => (
  <Button {...props} variant="toolbar" />
);
