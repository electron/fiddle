/**
 * A select whose menu starts with a search field: the version picker
 * (§17.8) and module versions (§17.10). The trigger, value and menu look
 * like the design system's Select. Typing filters the list, and the caller
 * does the filtering, so it controls matching and order. Actions (such as
 * "Copy version number") end the menu while nothing is typed; choosing one
 * calls `onAction`, not `onChange`.
 */
import { Fragment } from 'react';
import {
  Autocomplete,
  Button,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select,
  SelectValue,
  Separator,
  Text,
  TextField,
} from 'react-aria-components';

import { cx, Icon, type IconName } from '../../../ui';
import { useInCapsule } from '../../../ui/components/capsule';
import field from '../../../ui/components/Field.module.css';
import menu from '../../../ui/components/Menu.module.css';
import select from '../../../ui/components/Select.module.css';
import styles from './Versions.module.css';

export interface SearchOption {
  id: string;
  label: string;
  icon?: IconName;
  /** Muted text after the label, such as the install state. */
  detail?: string;
  /** Right-aligned hint in ink-muted, such as "latest" or "beta". */
  hint?: string;
  isDisabled?: boolean;
}

export interface SearchGroup {
  title?: string;
  options: SearchOption[];
}

export interface SearchSelectProps {
  'aria-label': string;
  'data-tour'?: string;
  groups: SearchGroup[];
  value: string | null;
  onChange: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** The search field's placeholder and accessible name. */
  searchLabel: string;
  /** Shown when nothing matches. */
  emptyLabel: string;
  /** The trigger's text while the value isn't in the list. */
  placeholder?: string;
  actions?: SearchOption[];
  onAction?: (id: string) => void;
  /** A note under the list, such as "Showing 150 of 2,000". */
  note?: string;
  isDisabled?: boolean;
  size?: 'md' | 'sm';
  className?: string;
}

function Option({ option }: { option: SearchOption }) {
  // The name is the label and hint ("Electron 43.0.0 latest"); the detail is its description.
  const name = option.hint ? `${option.label} ${option.hint}` : option.label;
  return (
    <ListBoxItem
      id={option.id}
      textValue={option.label}
      aria-label={name}
      isDisabled={option.isDisabled}
      className={menu.item}
    >
      {({ isSelected }) => (
        <>
          <span className={menu.lead}>
            {isSelected ? <Icon name="check" /> : option.icon ? <Icon name={option.icon} /> : null}
          </span>
          <span className={menu.label}>{option.label}</span>
          {option.detail && (
            <Text slot="description" className={styles.detail}>
              {option.detail}
            </Text>
          )}
          {option.hint && <span className={menu.hint}>{option.hint}</span>}
        </>
      )}
    </ListBoxItem>
  );
}

export function SearchSelect({
  groups,
  value,
  onChange,
  query,
  onQueryChange,
  searchLabel,
  emptyLabel,
  placeholder,
  actions = [],
  onAction,
  note,
  size = 'md',
  className,
  ...rest
}: SearchSelectProps) {
  const inCapsule = useInCapsule();
  const showActions = actions.length > 0 && query.trim() === '';
  return (
    <Select
      {...rest}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key == null) return;
        const id = String(key);
        if (actions.some((action) => action.id === id)) onAction?.(id);
        else onChange(id);
      }}
      onOpenChange={(isOpen) => {
        if (!isOpen) onQueryChange('');
      }}
      placeholder={placeholder}
      className={cx(select.root, className)}
      data-size={size}
      data-capsule={inCapsule || undefined}
    >
      <Button className={select.trigger}>
        <SelectValue className={select.value}>
          {/* Never react-aria's own "Select an item": only the caller's catalog string. */}
          {({ isPlaceholder, selectedText }) => (isPlaceholder ? placeholder : selectedText)}
        </SelectValue>
        <Icon name="chevron-down" className={select.chevron} />
      </Button>
      <Popover
        className={menu.popover}
        placement="bottom start"
        offset={inCapsule ? 13 : 4}
        crossOffset={inCapsule ? -3 : 0}
      >
        <div className={cx(menu.surface, styles.searchMenu)}>
          <Autocomplete inputValue={query} onInputChange={onQueryChange}>
            {/* A TextField, not a SearchField: one Escape closes the menu instead of clearing the text first. */}
            <div className={cx(field.root, styles.search)} data-size="sm">
              <TextField aria-label={searchLabel} autoFocus className={field.field}>
                <Icon name="search" size={14} className={field.icon} />
                <Input type="search" className={field.input} placeholder={searchLabel} />
              </TextField>
            </div>
            <ListBox
              className={styles.searchList}
              renderEmptyState={() => <div className={styles.empty}>{emptyLabel}</div>}
            >
              {groups.map((group, i) => (
                <Fragment key={group.title ?? `group-${i}`}>
                  {i > 0 && <Separator className={menu.separator} />}
                  <ListBoxSection className={menu.section}>
                    {group.title && <Header className={menu.header}>{group.title}</Header>}
                    {group.options.map((option) => (
                      <Option key={option.id} option={option} />
                    ))}
                  </ListBoxSection>
                </Fragment>
              ))}
              {showActions && (
                <Fragment key="actions">
                  {groups.length > 0 && <Separator className={menu.separator} />}
                  <ListBoxSection className={menu.section}>
                    {actions.map((action) => (
                      <Option key={action.id} option={action} />
                    ))}
                  </ListBoxSection>
                </Fragment>
              )}
            </ListBox>
          </Autocomplete>
          {note && <p className={styles.searchNote}>{note}</p>}
        </div>
      </Popover>
    </Select>
  );
}
