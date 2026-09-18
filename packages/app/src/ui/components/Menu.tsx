import type { ReactNode } from 'react';
import {
  Header,
  Keyboard,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection as AriaMenuSection,
  MenuTrigger as AriaMenuTrigger,
  Popover as AriaPopover,
  Separator,
  Text,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
  type MenuSectionProps as AriaMenuSectionProps,
  type PopoverProps as AriaPopoverProps,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Menu.module.css';

/** Wraps a trigger button and a MenuPopover. */
export const MenuTrigger = AriaMenuTrigger;

export interface MenuPopoverProps extends Omit<
  AriaPopoverProps,
  'className' | 'children'
> {
  children: ReactNode;
  className?: string;
}

/** Positions a menu. The Menu inside draws the glass. */
export function MenuPopover({
  children,
  className,
  placement = 'bottom start',
  offset = 4,
  ...rest
}: MenuPopoverProps) {
  return (
    <AriaPopover
      {...rest}
      placement={placement}
      offset={offset}
      className={cx(styles.popover, className)}
    >
      {children}
    </AriaPopover>
  );
}

export interface MenuProps<T> extends Omit<AriaMenuProps<T>, 'className'> {
  className?: string;
}

export function Menu<T extends object>({ className, ...rest }: MenuProps<T>) {
  return <AriaMenu {...rest} className={cx(styles.surface, className)} />;
}

export interface MenuItemProps extends Omit<AriaMenuItemProps, 'children' | 'className'> {
  children: ReactNode;
  icon?: IconName;
  /** Right-aligned hint in ink-muted, such as "latest". */
  hint?: string;
  /** Shortcut, such as "⌘R". */
  kbd?: string;
  isDanger?: boolean;
  className?: string;
}

export function MenuItem({
  children,
  icon,
  hint,
  kbd,
  isDanger,
  className,
  textValue,
  ...rest
}: MenuItemProps) {
  return (
    <AriaMenuItem
      {...rest}
      textValue={textValue ?? (typeof children === 'string' ? children : undefined)}
      className={cx(styles.item, className)}
      data-danger={isDanger || undefined}
    >
      {({ isSelected }) => (
        <>
          <span className={styles.lead}>
            {isSelected ? <Icon name="check" /> : icon ? <Icon name={icon} /> : null}
          </span>
          {/* The label slot names the item, so a hint or shortcut only describes it. */}
          <Text slot="label" className={styles.label}>
            {children}
          </Text>
          {hint && (
            <Text slot="description" className={styles.hint}>
              {hint}
            </Text>
          )}
          {kbd && <Keyboard className={styles.kbd}>{kbd}</Keyboard>}
        </>
      )}
    </AriaMenuItem>
  );
}

export interface MenuSectionProps extends Pick<
  AriaMenuSectionProps<object>,
  | 'selectionMode'
  | 'selectedKeys'
  | 'defaultSelectedKeys'
  | 'onSelectionChange'
  | 'disallowEmptySelection'
> {
  title?: string;
  children: ReactNode;
  className?: string;
}

/** A group of items with an optional caption header. Can carry its own selection. */
export function MenuSection({
  title,
  children,
  className,
  ...selection
}: MenuSectionProps) {
  return (
    <AriaMenuSection {...selection} className={cx(styles.section, className)}>
      {title && <Header className={styles.header}>{title}</Header>}
      {children}
    </AriaMenuSection>
  );
}

export function MenuSeparator() {
  return <Separator className={styles.separator} />;
}
