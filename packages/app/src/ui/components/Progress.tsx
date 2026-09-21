import { cx } from '../cx';
import styles from './Progress.module.css';

const SIZE = 14;
const STROKE = 2;
const MID = SIZE / 2;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export interface ProgressRingProps {
  /** 0 to 100. Leave undefined for a spinning, indeterminate ring. */
  value?: number;
  className?: string;
}

/** A 14px ring used in place of an icon. Decorative: its parent names the progress. */
export function ProgressRing({ value, className }: ProgressRingProps) {
  const spinning = value === undefined;
  const fraction = spinning ? 0.3 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <span className={cx(styles.ringWrap, className)}>
      <svg
        className={cx(styles.ring, spinning && styles.spin)}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        focusable="false"
      >
        <circle
          className={styles.ringTrack}
          cx={MID}
          cy={MID}
          r={R}
          fill="none"
          strokeWidth={STROKE}
        />
        <circle
          className={styles.ringBar}
          cx={MID}
          cy={MID}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraction)}
          transform={`rotate(-90 ${MID} ${MID})`}
        />
      </svg>
    </span>
  );
}

/** An indeterminate ring, for progress of unknown length. */
export function Spinner({ className }: { className?: string }) {
  return <ProgressRing className={className} />;
}
