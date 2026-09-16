import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
  /** `warning` draws the badge in the warning colour, for a count of warnings. */
  errorTone?: 'error' | 'warning';
  /** Unsaved dot after the badge. */
  unsaved?: boolean;
  /** Spoken with the dot, such as "Unsaved changes". */
  unsavedLabel?: string;
  /** A glyph before the label, such as the window glyph for a popped-out file. */
  icon?: IconName;
  /**
   * Makes the tab closable: a close glyph at its end, middle-click, and Delete
   * while it has focus.
   */
  onClose?: () => void;
  /** Makes the tab draggable, carrying `data` under the `type` media type. */
  drag?: { type: string; data: string };
  isDisabled?: boolean;
  className?: string;
}

/** 28 tall, padding 0 11, 12.5/16 at 500. Selected: hover fill, ink. */
export function Tab({
  id,
  children,
  errorCount,
  errorLabel,
  errorTone,
  unsaved,
  unsavedLabel,
  icon,
  onClose,
  drag,
  isDisabled,
  className,
}: TabProps) {
  // State, not a ref: React Aria mounts the tab's node after its first render.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const closable = onClose !== undefined;
  const latestClose = useRef(onClose);
  useLayoutEffect(() => {
    latestClose.current = onClose;
  });

  // React Aria's Tab doesn't pass `draggable` or key handlers through, so set them on the node.
  const dragType = drag?.type;
  const dragData = drag?.data;
  useEffect(() => {
    if (!node || dragType === undefined || dragData === undefined || isDisabled) return;
    node.setAttribute('draggable', 'true');
    const onDragStart = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.setData(dragType, dragData);
      event.dataTransfer.effectAllowed = 'move';
    };
    node.addEventListener('dragstart', onDragStart);
    return () => {
      node.removeAttribute('draggable');
      node.removeEventListener('dragstart', onDragStart);
    };
  }, [node, dragType, dragData, isDisabled]);

  useEffect(() => {
    if (!node || !closable) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return;
      event.preventDefault();
      latestClose.current?.();
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [node, closable]);

  return (
    <AriaTab
      ref={setNode}
      id={id}
      isDisabled={isDisabled}
      className={cx(styles.tab, className)}
      data-closable={closable || undefined}
      onAuxClick={
        onClose
          ? (event) => {
              if (event.button !== 1) return;
              event.preventDefault();
              onClose();
            }
          : undefined
      }
    >
      {icon && <Icon name={icon} className={styles.icon} />}
      <span className={styles.label}>{children}</span>
      {errorCount ? (
        <span className={styles.errors} data-tone={errorTone} aria-hidden="true">
          {errorCount}
        </span>
      ) : null}
      {errorCount && errorLabel ? <VisuallyHidden>{`, ${errorLabel}`}</VisuallyHidden> : null}
      {unsaved ? <span className={styles.dot} aria-hidden="true" /> : null}
      {unsaved && unsavedLabel ? <VisuallyHidden>{`, ${unsavedLabel}`}</VisuallyHidden> : null}
      {onClose && (
        // Hidden from assistive tech: a tab's content is presentational, so
        // keyboard and screen reader users close it with Delete instead.
        <span
          className={styles.close}
          aria-hidden="true"
          data-tab-close=""
          // Keep the press from selecting the tab first.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          <Icon name="close" size={12} />
        </span>
      )}
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
