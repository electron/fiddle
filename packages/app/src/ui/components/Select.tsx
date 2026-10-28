import type { CSSProperties } from 'react';
import {
  Button as AriaButton,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  Select as AriaSelect,
  SelectValue,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon } from '../icons/Icon';
import { useInCapsule } from './capsule';
import field from './Field.module.css';
import { MenuPopover } from './Menu';
import menu from './Menu.module.css';
import styles from './Select.module.css';

export interface SelectOption {
  id: string;
  label: string;
  /** Right-aligned hint in ink-muted, such as "latest" or "beta". */
  hint?: string;
}

export interface SelectProps {
  items: SelectOption[];
  label?: string;
  'aria-label'?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Option({ option }: { option: SelectOption }) {
  return (
    <ListBoxItem id={option.id} textValue={option.label} className={menu.item}>
      {({ isSelected }) => (
        <>
          <span className={menu.lead}>{isSelected && <Icon name="check" />}</span>
          <span className={menu.label}>{option.label}</span>
          {option.hint && <span className={menu.hint}>{option.hint}</span>}
        </>
      )}
    </ListBoxItem>
  );
}

export function Select({
  items,
  label,
  value,
  onChange,
  placeholder,
  errorMessage,
  className,
  style,
  ...rest
}: SelectProps) {
  const inCapsule = useInCapsule();
  return (
    <AriaSelect
      {...rest}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key != null) onChange?.(String(key));
      }}
      placeholder={placeholder}
      className={cx(styles.root, className)}
      style={style}
      data-capsule={inCapsule || undefined}
    >
      {label && <Label className={field.label}>{label}</Label>}
      <AriaButton className={styles.trigger}>
        <SelectValue className={styles.value}>
          {/* Never react-aria's own "Select an item": only the caller's catalog string. */}
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? placeholder : selectedText
          }
        </SelectValue>
        <Icon name="chevron-down" className={styles.chevron} />
      </AriaButton>
      <FieldError className={cx(field.help, field.error)}>{errorMessage}</FieldError>
      <MenuPopover offset={inCapsule ? 13 : 4} crossOffset={inCapsule ? -3 : 0}>
        <ListBox className={menu.surface}>
          {items.map((item) => (
            <Option key={item.id} option={item} />
          ))}
        </ListBox>
      </MenuPopover>
    </AriaSelect>
  );
}
