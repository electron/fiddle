import type { CSSProperties, ReactNode, Ref } from 'react';
import { cx } from '../cx';
import { CapsuleContext } from './capsule';
import styles from './Toolbar.module.css';

export interface ToolbarCapsuleProps {
  children: ReactNode;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/** A glass capsule that gathers toolbar controls. Buttons and selects inside it become 30px capsules. */
export function ToolbarCapsule({
  children,
  label,
  className,
  style,
  ref,
}: ToolbarCapsuleProps) {
  return (
    <CapsuleContext.Provider value={true}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className={cx(styles.capsule, className)}
        style={style}
      >
        {children}
      </div>
    </CapsuleContext.Provider>
  );
}
