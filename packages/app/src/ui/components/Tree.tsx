import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Tree as AriaTree,
  TreeItem,
  TreeItemContent,
  VisuallyHidden,
  type Key,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Tree.module.css';

export interface TreeProps {
  'aria-label': string;
  children: ReactNode;
  /** The selected row. */
  value?: string | null;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Sidebar rows sit on the glass: the selected row is a chip with shadow-lift. */
  variant?: 'sheet' | 'sidebar';
  expandedKeys?: Iterable<Key>;
  defaultExpandedKeys?: Iterable<Key>;
  onExpandedChange?: (keys: Set<Key>) => void;
  className?: string;
}

/** A tree of rows, 2px apart. Arrow keys move between rows; one Tab stop. */
export function Tree({ children, value, defaultValue, onChange, variant = 'sheet', className, ...rest }: TreeProps) {
  return (
    <AriaTree
      {...rest}
      selectionMode="single"
      selectionBehavior="replace"
      disallowEmptySelection
      selectedKeys={value === undefined ? undefined : value === null ? [] : [value]}
      defaultSelectedKeys={defaultValue !== undefined ? [defaultValue] : undefined}
      onSelectionChange={(keys) => {
        if (keys === 'all') return;
        const [key] = [...keys];
        if (key != null) onChange?.(String(key));
      }}
      className={cx(styles.tree, className)}
      data-variant={variant}
    >
      {children}
    </AriaTree>
  );
}

export interface TreeRowProps {
  id: string;
  label: string;
  icon?: IconName;
  /** Right-aligned pill in spark on spark-soft, such as "1 error". */
  pill?: string;
  /** `warning` draws the pill in the warning colour, such as "2 warnings". */
  pillTone?: 'error' | 'warning';
  unsaved?: boolean;
  unsavedLabel?: string;
  /** Text direction of the label, e.g. `ltr` for file names in a mirrored locale. */
  labelDir?: 'ltr' | 'rtl' | 'auto';
  isDisabled?: boolean;
  /** Nested rows. */
  children?: ReactNode;
  className?: string;
}

/** 28 tall, padding 0 8, radius-item, 16px icon with a 6px gap. */
export function TreeRow({
  id,
  label,
  icon = 'file',
  pill,
  pillTone,
  unsaved,
  unsavedLabel,
  labelDir,
  isDisabled,
  children,
  className,
}: TreeRowProps) {
  return (
    <TreeItem id={id} textValue={label} isDisabled={isDisabled} className={cx(styles.row, className)}>
      <TreeItemContent>
        {({ hasChildItems, isExpanded }) => (
          <>
            {hasChildItems && (
              <AriaButton slot="chevron" className={styles.chevron}>
                <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={12} />
              </AriaButton>
            )}
            <Icon name={icon} className={styles.icon} />
            <span className={styles.label} dir={labelDir}>
              {label}
            </span>
            {pill && (
              <span className={styles.pill} data-tone={pillTone}>
                {pill}
              </span>
            )}
            {unsaved && <span className={styles.dot} aria-hidden="true" />}
            {unsaved && unsavedLabel && <VisuallyHidden>{`, ${unsavedLabel}`}</VisuallyHidden>}
          </>
        )}
      </TreeItemContent>
      {children}
    </TreeItem>
  );
}
