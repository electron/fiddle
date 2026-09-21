import { ProgressBar as AriaProgressBar } from 'react-aria-components';
import { cx } from '../cx';
import styles from './Progress.module.css';

interface RingGraphicProps {
  /** 0 to 100. Leave undefined for a spinning, indeterminate ring. */
  value?: number;
  size: number;
}

function RingGraphic({ value, size }: RingGraphicProps) {
  const stroke = size > 16 ? 2.5 : 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const spinning = value === undefined;
  const fraction = spinning ? 0.3 : Math.max(0, Math.min(100, value)) / 100;
  const mid = size / 2;
  return (
    <svg
      className={cx(styles.ring, spinning && styles.spin)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className={styles.ringTrack}
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        strokeWidth={stroke}
      />
      <circle
        className={styles.ringBar}
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        transform={`rotate(-90 ${mid} ${mid})`}
      />
    </svg>
  );
}

export interface ProgressRingProps {
  /** 0 to 100. */
  value: number;
  /** 14 (default, fits a button) or 24. */
  size?: number;
  /** Accessible name. Without one the ring is decorative (its parent names the progress). */
  label?: string;
  className?: string;
}

/** A determinate ring, used in place of an icon. */
export function ProgressRing({ value, size = 14, label, className }: ProgressRingProps) {
  if (!label) {
    return (
      <span className={cx(styles.ringWrap, className)}>
        <RingGraphic value={value} size={size} />
      </span>
    );
  }
  return (
    <AriaProgressBar
      value={value}
      aria-label={label}
      className={cx(styles.ringWrap, className)}
    >
      <RingGraphic value={value} size={size} />
    </AriaProgressBar>
  );
}

export interface SpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

/** An indeterminate ring, for progress of unknown length. */
export function Spinner({ size = 14, label, className }: SpinnerProps) {
  if (!label) {
    return (
      <span className={cx(styles.ringWrap, className)}>
        <RingGraphic size={size} />
      </span>
    );
  }
  return (
    <AriaProgressBar
      isIndeterminate
      aria-label={label}
      className={cx(styles.ringWrap, className)}
    >
      <RingGraphic size={size} />
    </AriaProgressBar>
  );
}
