import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import styles from './SegmentedControl.module.css';

export interface SegmentOption {
  value: string;
  label?: string;
  icon?: IconName;
  /** Accessible name for icon-only segments. */
  'aria-label'?: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  /** Accessible name for the group. */
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: 'md' | 'sm';
  isDisabled?: boolean;
  className?: string;
}

/** Two to four exclusive options. Arrow keys move between segments; one Tab stop. */
export function SegmentedControl({
  options,
  label,
  value,
  defaultValue,
  onChange,
  size = 'md',
  isDisabled,
  className,
}: SegmentedControlProps) {
  const fallback =
    value === undefined && defaultValue === undefined ? options[0]?.value : defaultValue;
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={value !== undefined ? [value] : undefined}
      defaultSelectedKeys={fallback !== undefined ? [fallback] : undefined}
      onSelectionChange={(keys) => {
        const [key] = [...keys];
        if (key != null) onChange?.(String(key));
      }}
      isDisabled={isDisabled}
      className={cx(styles.track, className)}
      data-size={size}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          id={option.value}
          aria-label={option['aria-label']}
          className={styles.segment}
        >
          {option.icon && <Icon name={option.icon} />}
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
