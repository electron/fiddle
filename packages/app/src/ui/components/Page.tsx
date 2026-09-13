import { useState, type CSSProperties, type ReactNode } from 'react';
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
  /** Right-aligned count or hint. */
  badge?: string;
}

export interface SideNavHeading {
  heading: string;
}

export interface SideNavProps {
  'aria-label': string;
  items: Array<SideNavItem | SideNavHeading>;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
}

function isHeading(item: SideNavItem | SideNavHeading): item is SideNavHeading {
  return 'heading' in item;
}

/** Vertical navigation for settings. The current item takes the hover fill and an accent icon. */
export function SideNav({ items, value, defaultValue, onChange, className, ...rest }: SideNavProps) {
  const first = items.find((item): item is SideNavItem => !isHeading(item))?.id;
  const [inner, setInner] = useState(defaultValue ?? first);
  const current = value ?? inner;
  return (
    <nav aria-label={rest['aria-label']} className={cx(styles.nav, className)}>
      {items.map((item) =>
        isHeading(item) ? (
          <div key={`h-${item.heading}`} className={styles.heading}>
            {item.heading}
          </div>
        ) : (
          <AriaButton
            key={item.id}
            className={styles.item}
            aria-current={item.id === current ? 'page' : undefined}
            onPress={() => {
              setInner(item.id);
              onChange?.(item.id);
            }}
          >
            {item.icon && <Icon name={item.icon} className={styles.itemIcon} />}
            <span className={styles.itemLabel}>{item.label}</span>
            {item.badge && <span className={styles.badge}>{item.badge}</span>}
          </AriaButton>
        ),
      )}
    </nav>
  );
}

export interface PageProps {
  title: string;
  /** Usually a SideNav. */
  nav: ReactNode;
  children: ReactNode;
  /** Adds a close button (and closes on Escape). */
  onClose?: () => void;
  closeLabel?: string;
  /** Key cap under the close button, such as "esc". */
  closeHint?: string;
  className?: string;
  style?: CSSProperties;
}

/** A full-window page with a side nav, used for settings. Fills its container. */
export function Page({ title, nav, children, onClose, closeLabel, closeHint, className, style }: PageProps) {
  return (
    <div
      className={cx(styles.page, className)}
      style={style}
      onKeyDown={
        onClose
          ? (e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
              }
            }
          : undefined
      }
    >
      <aside className={styles.aside}>
        <h1 className={styles.title}>{title}</h1>
        {nav}
      </aside>
      <div className={styles.body}>
        {onClose && closeLabel && (
          <div className={styles.close}>
            <IconButton icon="close" label={closeLabel} onPress={onClose} />
            {closeHint && <Kbd>{closeHint}</Kbd>}
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
