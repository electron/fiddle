import { Fragment, type CSSProperties } from 'react';
import {
  Button as AriaButton,
  FieldError,
  Header,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover as AriaPopover,
  Select as AriaSelect,
  SelectValue,
  Separator,
  Text,
} from 'react-aria-components';
import { cx } from '../cx';
import { Icon, type IconName } from '../icons/Icon';
import { useInCapsule } from './capsule';
import field from './Field.module.css';
import menu from './Menu.module.css';
import styles from './Select.module.css';

export interface SelectOption {
  id: string;
  label: string;
  /** Right-aligned hint in ink-muted, such as "latest" or "beta". */
  hint?: string;
  icon?: IconName;
  isDisabled?: boolean;
}

export interface SelectGroup {
  title: string;
  options: SelectOption[];
}

export type SelectItems = Array<SelectOption | SelectGroup>;

export interface SelectProps {
  items: SelectItems;
  label?: string;
  'aria-label'?: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  description?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  size?: 'md' | 'sm';
  icon?: IconName;
  name?: string;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

function isGroup(item: SelectOption | SelectGroup): item is SelectGroup {
  return 'options' in item;
}

function Option({ option }: { option: SelectOption }) {
  return (
    <ListBoxItem
      id={option.id}
      textValue={option.label}
      isDisabled={option.isDisabled}
      className={menu.item}
    >
      {({ isSelected }) => (
        <>
          <span className={menu.lead}>
            {isSelected ? (
              <Icon name="check" />
            ) : option.icon ? (
              <Icon name={option.icon} />
            ) : null}
          </span>
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
  defaultValue,
  onChange,
  placeholder,
  description,
  errorMessage,
  size = 'md',
  icon,
  className,
  style,
  ...rest
}: SelectProps) {
  const inCapsule = useInCapsule();
  return (
    <AriaSelect
      {...rest}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => {
        if (key != null) onChange?.(String(key));
      }}
      placeholder={placeholder}
      className={cx(styles.root, className)}
      style={style}
      data-size={size}
      data-capsule={inCapsule || undefined}
    >
      {label && <Label className={field.label}>{label}</Label>}
      <AriaButton className={styles.trigger}>
        {icon && <Icon name={icon} className={styles.icon} />}
        <SelectValue className={styles.value}>
          {/* Never react-aria's own "Select an item": only the caller's catalog string. */}
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? placeholder : selectedText
          }
        </SelectValue>
        <Icon name="chevron-down" className={styles.chevron} />
      </AriaButton>
      {description && (
        <Text slot="description" className={field.help}>
          {description}
        </Text>
      )}
      <FieldError className={cx(field.help, field.error)}>{errorMessage}</FieldError>
      <AriaPopover
        className={menu.popover}
        placement="bottom start"
        offset={inCapsule ? 13 : 4}
        crossOffset={inCapsule ? -3 : 0}
      >
        <ListBox className={menu.surface}>
          {items.map((item, i) =>
            isGroup(item) ? (
              <Fragment key={item.title}>
                {i > 0 && <Separator className={menu.separator} />}
                <ListBoxSection className={menu.section}>
                  <Header className={menu.header}>{item.title}</Header>
                  {item.options.map((option) => (
                    <Option key={option.id} option={option} />
                  ))}
                </ListBoxSection>
              </Fragment>
            ) : (
              <Option key={item.id} option={item} />
            ),
          )}
        </ListBox>
      </AriaPopover>
    </AriaSelect>
  );
}
