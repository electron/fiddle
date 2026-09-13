import type { ReactElement, ReactNode } from 'react';
import { Focusable, Tooltip as AriaTooltip, TooltipTrigger, type TooltipProps as AriaTooltipProps } from 'react-aria-components';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  label: ReactNode;
  /** Shortcut after the label, such as "⌘\". */
  kbd?: string;
  /** A react-aria focusable, such as Button or IconButton. */
  children: ReactElement;
  placement?: AriaTooltipProps['placement'];
  /** Milliseconds before it appears. */
  delay?: number;
  /** Set when the trigger is disabled, so the tooltip can still explain why. */
  triggerDisabled?: boolean;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  isDisabled?: boolean;
}

/** Appears after 500ms, below the target by default. */
export function Tooltip({
  label,
  kbd,
  children,
  placement = 'bottom',
  delay = 500,
  triggerDisabled,
  isOpen,
  defaultOpen,
  onOpenChange,
  isDisabled,
}: TooltipProps) {
  const trigger = triggerDisabled ? (
    <Focusable>
      <span tabIndex={0} className={styles.disabledTrigger}>
        {children}
      </span>
    </Focusable>
  ) : (
    children
  );
  return (
    <TooltipTrigger
      delay={delay}
      isOpen={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      isDisabled={isDisabled}
    >
      {trigger}
      <AriaTooltip placement={placement} offset={6} className={styles.tooltip}>
        {label}
        {kbd && <span className={styles.kbd}>{kbd}</span>}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
