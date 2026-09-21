import type { ReactNode } from 'react';
import { ListBox, ListBoxItem } from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import styles from './Content.module.css';

export interface ListProps {
  'aria-label': string;
  children: ReactNode;
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}

/** A selectable list of rows. Arrow keys move; one Tab stop. */
export function List({ children, value, onChange, className, ...rest }: ListProps) {
  return (
    <ListBox
      aria-label={rest['aria-label']}
      selectionMode="single"
      selectedKeys={value === null ? [] : [value]}
      onSelectionChange={(keys) => {
        if (keys === 'all') return;
        const [key] = [...keys];
        if (key != null) onChange(String(key));
      }}
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
}

export function ListRow({ id, title, meta, icon, tags }: ListRowProps) {
  return (
    <ListBoxItem id={id} textValue={title} className={styles.row}>
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
}

function isSection<Row>(row: Row | TableSection): row is TableSection {
  return typeof row === 'object' && row !== null && 'section' in row;
}

export function Table<Row extends { id: string }>({
  columns,
  rows,
  emptyMessage,
  ...rest
}: TableProps<Row>) {
  return (
    <div className={styles.tableWrap}>
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
                <tr key={row.id} className={styles.tr}>
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

/** A pill with a status dot. */
export function StatusPill({ children, className }: StatusPillProps) {
  return (
    <span className={cx(styles.pill, className)}>
      <span className={styles.pillDot} aria-hidden="true" />
      {children}
    </span>
  );
}
