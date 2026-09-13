import type { ReactNode } from 'react';
import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
  VisuallyHidden,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Tabs.module.css';

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, defaultValue, onChange, children, className }: TabsProps) {
  return (
    <AriaTabs
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onChange?.(String(key))}
      className={cx(styles.tabs, className)}
    >
      {children}
    </AriaTabs>
  );
}

export interface TabListProps {
  'aria-label': string;
  children: ReactNode;
  className?: string;
}

/** Tabs 2px apart. Arrow keys move between tabs; one Tab stop. */
export function TabList({ children, className, ...rest }: TabListProps) {
  return (
    <AriaTabList aria-label={rest['aria-label']} className={cx(styles.list, className)}>
      {children}
    </AriaTabList>
  );
}

export interface TabProps {
  id: string;
  children: ReactNode;
  /** Error count badge after the label. */
  errorCount?: number;
  /** Spoken with the badge, such as "1 error". */
  errorLabel?: string;
  /** Unsaved dot after the badge. */
  unsaved?: boolean;
  /** Spoken with the dot, such as "Unsaved changes". */
  unsavedLabel?: string;
  /** A glyph before the label, such as the window glyph for a popped-out file. */
  icon?: IconName;
  isDisabled?: boolean;
  className?: string;
}

/** 28 tall, padding 0 11, 12.5/16 at 500. Selected: hover fill, ink. */
export function Tab({ id, children, errorCount, errorLabel, unsaved, unsavedLabel, icon, isDisabled, className }: TabProps) {
  return (
    <AriaTab id={id} isDisabled={isDisabled} className={cx(styles.tab, className)}>
      {icon && <Icon name={icon} className={styles.icon} />}
      <span className={styles.label}>{children}</span>
      {errorCount ? (
        <span className={styles.errors} aria-hidden="true">
          {errorCount}
        </span>
      ) : null}
      {errorCount && errorLabel ? <VisuallyHidden>{`, ${errorLabel}`}</VisuallyHidden> : null}
      {unsaved ? <span className={styles.dot} aria-hidden="true" /> : null}
      {unsaved && unsavedLabel ? <VisuallyHidden>{`, ${unsavedLabel}`}</VisuallyHidden> : null}
    </AriaTab>
  );
}

export interface TabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, children, className }: TabPanelProps) {
  return (
    <AriaTabPanel id={id} className={cx(styles.panel, className)}>
      {children}
    </AriaTabPanel>
  );
}
