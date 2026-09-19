import type { CSSProperties, ReactNode, Ref } from 'react';
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { CapsuleContext } from './capsule';
import styles from './Toolbar.module.css';

export interface ToolbarCapsuleProps {
  children: ReactNode;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/** A glass capsule that gathers toolbar controls. Buttons and selects inside it become 30px capsules. */
export function ToolbarCapsule({
  children,
  label,
  className,
  style,
  ref,
}: ToolbarCapsuleProps) {
  return (
    <CapsuleContext.Provider value={true}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className={cx(styles.capsule, className)}
        style={style}
      >
        {children}
      </div>
    </CapsuleContext.Provider>
  );
}

export interface ToolbarButtonProps extends Omit<
  AriaButtonProps,
  'children' | 'className' | 'style' | 'aria-label'
> {
  icon?: IconName;
  /** Visible label. Leave out for a 36 × 36 icon button. */
  children?: ReactNode;
  /** Accessible name when there's no visible label. */
  label: string;
  isPressed?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A standalone 36px glass capsule button on the chrome. */
export function ToolbarButton({
  icon,
  children,
  label,
  isPressed,
  className,
  style,
  ...rest
}: ToolbarButtonProps) {
  const iconOnly = children == null;
  return (
    <AriaButton
      {...rest}
      aria-label={iconOnly ? label : undefined}
      aria-pressed={isPressed}
      className={cx(styles.button, className)}
      style={style}
      data-icon-only={iconOnly || undefined}
    >
      {icon && <Icon name={icon} className={iconOnly ? undefined : styles.lead} />}
      {!iconOnly && <span className={styles.label}>{children}</span>}
    </AriaButton>
  );
}
