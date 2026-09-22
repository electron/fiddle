import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { singleSelection } from './Content';
import styles from './SegmentedControl.module.css';

export interface SegmentOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  /** Accessible name for the group. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  size?: 'md' | 'sm';
  isDisabled?: boolean;
}

/** Two to four exclusive options. Arrow keys move between segments; one Tab stop. */
export function SegmentedControl({
  options,
  label,
  value,
  onChange,
  size = 'md',
  isDisabled,
}: SegmentedControlProps) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={singleSelection(onChange)}
      isDisabled={isDisabled}
      className={styles.track}
      data-size={size}
    >
      {options.map((option) => (
        <ToggleButton key={option.value} id={option.value} className={styles.segment}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
