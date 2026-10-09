import type { ReactNode } from 'react';
import {
  Tree as AriaTree,
  TreeItem,
  TreeItemContent,
  VisuallyHidden,
} from 'react-aria-components';
import { Icon } from '../icons/Icon';
import { pointerPress, singleSelection } from './Content';
import styles from './Tree.module.css';

export interface TreeProps {
  'aria-label': string;
  children: ReactNode;
  /** The selected row. */
  value: string | null;
  onChange: (id: string) => void;
}

/** Sidebar file rows on the glass. Arrow keys move between rows; one Tab stop. */
export function Tree({ children, value, onChange, ...rest }: TreeProps) {
  return (
    <AriaTree
      {...rest}
      selectionMode="single"
      selectionBehavior="replace"
      disallowEmptySelection
      selectedKeys={value === null ? [] : [value]}
      onSelectionChange={singleSelection(onChange)}
      className={styles.tree}
    >
      {children}
    </AriaTree>
  );
}

export interface TreeRowProps {
  id: string;
  label: string;
  /** Right-aligned pill in spark on spark-soft, such as "1 error". */
  pill?: string;
  /** `warning` draws the pill in the warning colour, such as "2 warnings". */
  pillTone?: 'error' | 'warning';
  /** Draws an unsaved dot. The text is spoken with it, such as "Unsaved changes". */
  unsaved?: string;
  /** Text direction of the label, e.g. `ltr` for file names in a mirrored locale. */
  labelDir?: 'ltr' | 'rtl' | 'auto';
  /** The row was pressed with a mouse, pen or finger, not from the keyboard or a screen reader. */
  onPointerPress?: () => void;
}

export function TreeRow({
  id,
  label,
  pill,
  pillTone,
  unsaved,
  labelDir,
  onPointerPress,
}: TreeRowProps) {
  return (
    <TreeItem
      id={id}
      data-key={id}
      textValue={label}
      className={styles.row}
      onPress={pointerPress(onPointerPress)}
    >
      <TreeItemContent>
        <Icon name="file" className={styles.icon} />
        <span className={styles.label} dir={labelDir}>
          {label}
        </span>
        {pill && (
          <span className={styles.pill} data-tone={pillTone}>
            {pill}
          </span>
        )}
        {unsaved && (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <VisuallyHidden>{`, ${unsaved}`}</VisuallyHidden>
          </>
        )}
      </TreeItemContent>
    </TreeItem>
  );
}
