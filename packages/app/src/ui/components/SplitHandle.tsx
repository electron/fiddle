import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cx } from '../cx';
import styles from './SplitHandle.module.css';

export interface SplitHandleProps {
  /** vertical sits between side-by-side panes and resizes a width; horizontal resizes a height. */
  orientation?: 'vertical' | 'horizontal';
  /** The size of the pane this handle controls, in px. */
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Accessible name, such as "Resize sidebar". */
  label: string;
  /** Keyboard step in px. */
  step?: number;
  /** Set when the controlled pane is after the handle (right or below), so dragging toward it shrinks it. */
  reverse?: boolean;
  /** Double-click or Enter restores the default size. */
  onReset?: () => void;
  className?: string;
}

/** A resize divider: invisible until hover, then a 2px accent line.
 *  Arrow keys resize, Home and End jump to the limits. */
export function SplitHandle({
  orientation = 'vertical',
  value,
  min,
  max,
  onChange,
  label,
  step = 8,
  reverse = false,
  onReset,
  className,
}: SplitHandleProps) {
  const start = useRef<{ pos: number; value: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const vertical = orientation === 'vertical';
  const sign = reverse ? -1 : 1;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const pointerPos = (e: PointerEvent) => (vertical ? e.clientX : e.clientY);

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const back = vertical ? 'ArrowLeft' : 'ArrowUp';
    const forward = vertical ? 'ArrowRight' : 'ArrowDown';
    let next: number | null = null;
    if (e.key === back) next = value - step * sign;
    else if (e.key === forward) next = value + step * sign;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else if (e.key === 'Enter' && onReset) {
      e.preventDefault();
      onReset();
      return;
    }
    if (next === null) return;
    e.preventDefault();
    onChange(clamp(next));
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cx(styles.handle, className)}
      data-orientation={orientation}
      data-dragging={dragging || undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        start.current = { pos: pointerPos(e), value };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onChange(clamp(start.current.value + sign * (pointerPos(e) - start.current.pos)));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
