import type { CSSProperties, ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { IconButton } from './Button';
import { Kbd } from './Labels';
import styles from './Page.module.css';

export interface SideNavItem {
  id: string;
  label: string;
  icon?: IconName;
}

export interface SideNavProps {
  'aria-label': string;
  items: SideNavItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Vertical navigation between the sections of a Page. */
export function SideNav({ items, value, onChange, className, ...rest }: SideNavProps) {
  return (
    <nav aria-label={rest['aria-label']} className={cx(styles.nav, className)}>
      {items.map((item) => (
        <AriaButton
          key={item.id}
          className={styles.item}
          aria-current={item.id === value ? 'true' : undefined}
          onPress={() => onChange(item.id)}
        >
          {item.icon && <Icon name={item.icon} className={styles.itemIcon} />}
          <span className={styles.itemLabel}>{item.label}</span>
        </AriaButton>
      ))}
    </nav>
  );
}

export interface PageProps {
  title: string;
  /** Usually a SideNav. */
  nav: ReactNode;
  children: ReactNode;
  /** Called by the close button and on Escape. */
  onClose: () => void;
  closeLabel: string;
  /** Key cap under the close button, such as "esc". */
  closeHint?: string;
  className?: string;
  style?: CSSProperties;
}

/** A full-window page with a side nav. Fills its container. */
export function Page({
  title,
  nav,
  children,
  onClose,
  closeLabel,
  closeHint,
  className,
  style,
}: PageProps) {
  return (
    <div
      className={cx(styles.page, className)}
      style={style}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.nativeEvent.isComposing && !e.defaultPrevented) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <aside className={styles.aside}>
        <h1 className={styles.title}>{title}</h1>
        {nav}
      </aside>
      <div className={styles.body}>
        <div className={styles.close}>
          <IconButton icon="close" label={closeLabel} onPress={onClose} />
          {closeHint && <Kbd>{closeHint}</Kbd>}
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
