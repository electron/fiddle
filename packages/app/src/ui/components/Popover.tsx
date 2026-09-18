import type { CSSProperties, ReactNode } from 'react';
import {
  Dialog as AriaDialog,
  DialogTrigger,
  OverlayArrow,
  Popover as AriaPopover,
  type PopoverProps as AriaPopoverProps,
} from 'react-aria-components';
import { cx } from '../cx';
import styles from './Popover.module.css';

/** Wraps a trigger button and a Popover. */
export const PopoverTrigger = DialogTrigger;

export interface PopoverProps extends Omit<
  AriaPopoverProps,
  'className' | 'children' | 'style'
> {
  children: ReactNode;
  /** Accessible name for the popover's dialog. */
  'aria-label'?: string;
  width?: number;
  className?: string;
  style?: CSSProperties;
}

/** Anchored floating content on overlay glass, with an arrow cut from the same material. */
export function Popover({
  children,
  width,
  className,
  style,
  placement = 'bottom',
  offset = 10,
  ...rest
}: PopoverProps) {
  const { 'aria-label': ariaLabel, ...popoverProps } = rest;
  return (
    <AriaPopover
      {...popoverProps}
      placement={placement}
      offset={offset}
      className={cx(styles.popover, className)}
      style={{ width, ...style }}
    >
      <OverlayArrow className={styles.arrow}>
        <svg width={14} height={7} viewBox="0 0 14 7" aria-hidden="true">
          <path d="M0 0 L7 7 L14 0" />
        </svg>
      </OverlayArrow>
      <AriaDialog aria-label={ariaLabel} className={styles.dialog}>
        {children}
      </AriaDialog>
    </AriaPopover>
  );
}
