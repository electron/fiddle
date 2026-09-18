/**
 * A select whose menu starts with a search field: the version picker
 * and module versions. The trigger, value and menu look
 * like the design system's Select. Typing filters the list, and the caller
 * does the filtering, so it controls matching and order. Actions (such as
 * "Copy version number") end the menu while nothing is typed; choosing one
 * calls `onAction`, not `onChange`.
 *
 * The list can hold thousands of versions, so it's virtualized: only the
 * rows in view are in the DOM, and the list is rebuilt only when `groups` or
 * `actions` change. Row text that changes often (download progress) goes in
 * `details` instead, which re-renders the rows showing it and nothing else.
 */
import { createContext, Fragment, memo, use, useMemo } from 'react';
import {
  Autocomplete,
  Button,
  Header,
  Input,
  LayoutInfo,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  ListLayout,
  Popover,
  Rect,
  Select,
  SelectValue,
  Separator,
  Text,
  TextField,
  Virtualizer,
  type ListLayoutOptions,
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
  emptyLabel: string;
  /** The trigger's text while the value isn't in the list. */
  placeholder?: string;
  actions?: SearchOption[];
  onAction?: (id: string) => void;
  /**
   * Detail text by option id that replaces the option's own and may change
   * many times a second, such as "Downloading 42%". A change re-renders the
   * rows in view, not the list.
   */
  details?: Readonly<Record<string, string>>;
  /** A note under the list, such as "Showing 150 of 2,000". */
  note?: string;
  isDisabled?: boolean;
  size?: 'md' | 'sm';
  className?: string;
}

const NO_ACTIONS: SearchOption[] = [];
const NO_DETAILS: Readonly<Record<string, string>> = {};

/**
 * Row heights in px for the virtualized list. They mirror Menu.module.css:
 * an item is size-row tall, a header is a caption line (14) with 8 above and
 * 4 below, and a separator is a hairline with 5 above and below.
 */
const ROW_HEIGHT = 28;
const HEADING_HEIGHT = 26;
const SEPARATOR_HEIGHT = 11;
const LAYOUT_OPTIONS: ListLayoutOptions = {
  rowSize: ROW_HEIGHT,
  headingSize: HEADING_HEIGHT,
};
/** How many of the longest rows size the menu (see `Sizer`). */
const SIZER_ROWS = 6;

/** react-aria's list layout, except that separators are hairlines rather than full rows. */
class MenuLayout extends ListLayout<unknown> {
  protected override buildNode(
    ...[node, x, y]: Parameters<ListLayout<unknown>['buildNode']>
  ) {
    if (node.type !== 'separator') return super.buildNode(node, x, y);
    const width = (this.virtualizer?.size.width ?? 0) - this.padding - x;
    const rect = new Rect(x, y, width, SEPARATOR_HEIGHT);
    return {
      layoutInfo: new LayoutInfo(node.type, node.key, rect),
      children: [],
      validRect: rect.intersection(this.requestedRect),
      node,
    };
  }
}

const DetailsContext = createContext(NO_DETAILS);

/** A row's detail: the live one from `details`, else the option's own. */
function Detail({ id, text }: { id: string; text?: string }) {
  const detail = use(DetailsContext)[id] ?? text;
  if (!detail) return null;
  return (
    <Text slot="description" className={styles.detail}>
      {detail}
    </Text>
  );
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
            {isSelected ? (
              <Icon name="check" />
            ) : option.icon ? (
              <Icon name={option.icon} />
            ) : null}
          </span>
          <span className={menu.label}>{option.label}</span>
          <Detail id={option.id} text={option.detail} />
          {option.hint && <span className={menu.hint}>{option.hint}</span>}
        </>
      )}
    </ListBoxItem>
  );
}

const textLength = (option: SearchOption) =>
  option.label.length + (option.detail?.length ?? 0) + (option.hint?.length ?? 0);

/**
 * Virtualized rows are positioned absolutely, so they can't size the menu.
 * These hidden, zero-height copies of the longest rows do instead, so the
 * menu still grows to fit its longest label, between 200 and 360px.
 */
function Sizer({
  groups,
  actions,
}: {
  groups: readonly SearchGroup[];
  actions: readonly SearchOption[];
}) {
  const longest = useMemo(
    () =>
      groups
        .flatMap((group) => group.options)
        .concat(actions)
        .sort((a, b) => textLength(b) - textLength(a))
        .slice(0, SIZER_ROWS),
    [groups, actions],
  );
  return (
    <div className={styles.sizer} aria-hidden>
      {longest.map((option) => (
        <div key={option.id} className={menu.item}>
          <span className={menu.lead} />
          <span className={menu.label}>{option.label}</span>
          {option.detail && <span className={styles.detail}>{option.detail}</span>}
          {option.hint && <span className={menu.hint}>{option.hint}</span>}
        </div>
      ))}
    </div>
  );
}

/** Memoized: with stable props, a re-render of the caller costs nothing here. */
export const SearchSelect = memo(function SearchSelect({
  groups,
  value,
  onChange,
  query,
  onQueryChange,
  searchLabel,
  emptyLabel,
  placeholder,
  actions = NO_ACTIONS,
  onAction,
  details = NO_DETAILS,
  note,
  size = 'md',
  className,
  ...rest
}: SearchSelectProps) {
  const inCapsule = useInCapsule();
  const showActions = actions.length > 0 && query.trim() === '';
  // The same element while the options don't change, so a re-render of the
  // caller (a store push) skips the list and its collection entirely.
  const list = useMemo(
    () => (
      <Virtualizer layout={MenuLayout} layoutOptions={LAYOUT_OPTIONS}>
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
      </Virtualizer>
    ),
    [groups, actions, showActions, emptyLabel],
  );
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
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? placeholder : selectedText
          }
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
            <DetailsContext value={details}>{list}</DetailsContext>
          </Autocomplete>
          {note && <p className={styles.searchNote}>{note}</p>}
          <Sizer groups={groups} actions={showActions ? actions : NO_ACTIONS} />
        </div>
      </Popover>
    </Select>
  );
});
