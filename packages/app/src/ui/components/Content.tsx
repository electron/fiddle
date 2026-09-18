import type { CSSProperties, ReactNode } from 'react';
import { Button as AriaButton, ListBox, ListBoxItem } from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Content.module.css';

export interface CardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  /** A name to show as initials in place of an icon. */
  avatar?: string;
  /** Makes the whole card a button. */
  onPress?: () => void;
  children?: ReactNode;
  className?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Card({
  title,
  description,
  icon,
  avatar,
  onPress,
  children,
  className,
}: CardProps) {
  const content = (
    <>
      {(icon || avatar) && (
        <span className={styles.avatar} aria-hidden={avatar ? true : undefined}>
          {avatar ? initials(avatar) : <Icon name={icon!} />}
        </span>
      )}
      <span className={styles.cardMain}>
        <span className={styles.cardTitle}>{title}</span>
        {description && <span className={styles.cardSub}>{description}</span>}
      </span>
      {children}
    </>
  );
  return onPress ? (
    <AriaButton className={cx(styles.card, className)} onPress={onPress} data-interactive>
      {content}
    </AriaButton>
  ) : (
    <div className={cx(styles.card, className)}>{content}</div>
  );
}

export interface ListProps {
  'aria-label': string;
  children: ReactNode;
  value?: string | null;
  defaultValue?: string;
  onChange?: (id: string) => void;
  onAction?: (id: string) => void;
  className?: string;
}

/** A selectable list of rows. Arrow keys move; one Tab stop. */
export function List({
  children,
  value,
  defaultValue,
  onChange,
  onAction,
  className,
  ...rest
}: ListProps) {
  return (
    <ListBox
      aria-label={rest['aria-label']}
      selectionMode="single"
      selectedKeys={value === undefined ? undefined : value === null ? [] : [value]}
      defaultSelectedKeys={defaultValue !== undefined ? [defaultValue] : undefined}
      onSelectionChange={(keys) => {
        if (keys === 'all') return;
        const [key] = [...keys];
        if (key != null) onChange?.(String(key));
      }}
      onAction={onAction ? (key) => onAction(String(key)) : undefined}
      className={cx(styles.list, className)}
    >
      {children}
    </ListBox>
  );
}

export interface ListRowProps {
  id: string;
  title: string;
  meta?: string;
  icon?: IconName;
  /** Trailing content, usually Tags. */
  tags?: ReactNode;
  isDisabled?: boolean;
  className?: string;
}

export function ListRow({
  id,
  title,
  meta,
  icon,
  tags,
  isDisabled,
  className,
}: ListRowProps) {
  return (
    <ListBoxItem
      id={id}
      textValue={title}
      isDisabled={isDisabled}
      className={cx(styles.row, className)}
    >
      {icon && <Icon name={icon} className={styles.rowIcon} />}
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{title}</span>
        {meta && <span className={styles.rowMeta}>{meta}</span>}
      </span>
      {tags && <span className={styles.rowTags}>{tags}</span>}
    </ListBoxItem>
  );
}

export interface TableColumn<Row> {
  key: string;
  label: ReactNode;
  /** A CSS width, such as "90px" or "30%". */
  width?: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  render?: (row: Row) => ReactNode;
}

export interface TableSection {
  section: string;
}

export interface TableProps<Row extends { id: string }> {
  columns: TableColumn<Row>[];
  rows: Array<Row | TableSection>;
  'aria-label'?: string;
  /** Shown when there are no rows. */
  emptyMessage?: ReactNode;
  selectedIds?: string[];
  className?: string;
  style?: CSSProperties;
}

function isSection<Row>(row: Row | TableSection): row is TableSection {
  return typeof row === 'object' && row !== null && 'section' in row;
}

export function Table<Row extends { id: string }>({
  columns,
  rows,
  emptyMessage,
  selectedIds = [],
  className,
  style,
  ...rest
}: TableProps<Row>) {
  return (
    <div className={cx(styles.tableWrap, className)} style={style}>
      <table className={styles.table} aria-label={rest['aria-label']}>
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.key}
              style={column.width ? { width: column.width } : undefined}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" style={{ textAlign: column.align }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && emptyMessage ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) =>
              isSection(row) ? (
                <tr key={`s-${i}`} className={styles.section}>
                  <th colSpan={columns.length} scope="colgroup">
                    {row.section}
                  </th>
                </tr>
              ) : (
                <tr
                  key={row.id}
                  className={styles.tr}
                  aria-selected={selectedIds.includes(row.id) || undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.mono ? styles.mono : undefined}
                      style={{ textAlign: column.align }}
                    >
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ),
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface StatusPillProps {
  children: ReactNode;
  className?: string;
}

/** The status bar's "Running" pill. */
export function StatusPill({ children, className }: StatusPillProps) {
  return (
    <span className={cx(styles.pill, className)}>
      <span className={styles.pillDot} aria-hidden="true" />
      {children}
    </span>
  );
}
