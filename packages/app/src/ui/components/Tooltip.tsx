import type { ReactElement, ReactNode } from 'react';
import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  label: ReactNode;
  /** Shortcut after the label, such as "⌘\". */
  kbd?: string;
  /** A react-aria focusable, such as Button or IconButton. */
  children: ReactElement;
  isDisabled?: boolean;
}

export function Tooltip({ label, kbd, children, isDisabled }: TooltipProps) {
  return (
    <TooltipTrigger delay={500} isDisabled={isDisabled}>
      {children}
      <AriaTooltip placement="bottom" offset={10} className={styles.tooltip}>
        {label}
        {kbd && <span className={styles.kbd}>{kbd}</span>}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
