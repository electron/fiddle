import * as React from 'react';

import {
  Button,
  ButtonGroupProps,
  ContextMenu,
  IconName,
  Intent,
  Menu,
  MenuItem,
} from '@blueprintjs/core';
import { Tooltip2 } from '@blueprintjs/popover2';
import {
  ItemListPredicate,
  ItemListRenderer,
  ItemRenderer,
  Select,
} from '@blueprintjs/select';
import { observer } from 'mobx-react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import semver from 'semver';

import { InstallState, RunnableVersion, VersionSource } from '../../interfaces';
import { AppState } from '../state';
import { disableDownload } from '../utils/disable-download';
import { highlightText } from '../utils/highlight-text';

/**
 * Returns the display text for a version item.
 * For local builds, shows the custom name; for remote, shows the version string.
 */
export function getItemDisplayText(item: RunnableVersion): string {
  if (item.source === VersionSource.local) {
    return item.name || 'Local Build';
  }
  return item.version;
}

const ElectronVersionSelect = Select.ofType<RunnableVersion>();

/**
 * Represents either a real version item or a section header in the list.
 */
type ListEntry =
  | { type: 'header'; label: string }
  | { type: 'item'; item: RunnableVersion; originalIndex: number };

const HEADER_HEIGHT = 28;
const ITEM_HEIGHT = 30;

const FixedSizeListItem = ({ index, data, style }: ListChildComponentProps) => {
  const { entries, renderItem } = data;
  const entry: ListEntry = entries[index];

  if (entry.type === 'header') {
    return (
      <div
        style={{
          ...style,
          padding: '4px 8px',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: 'var(--text-muted, #999)',
          letterSpacing: '0.5px',
          borderBottom: '1px solid var(--divider, #333)',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {entry.label}
      </div>
    );
  }

  const renderedItem = renderItem(entry.item, entry.originalIndex);
  return <div style={style}>{renderedItem}</div>;
};

/**
 * Builds a list of entries with section headers separating local and remote versions.
 */
function buildListEntries(filteredItems: RunnableVersion[]): ListEntry[] {
  const locals = filteredItems.filter((v) => v.source === VersionSource.local);
  const remotes = filteredItems.filter((v) => v.source !== VersionSource.local);

  const entries: ListEntry[] = [];

  if (locals.length > 0) {
    entries.push({ type: 'header', label: 'Local Builds' });
    locals.forEach((item, i) =>
      entries.push({ type: 'item', item, originalIndex: i }),
    );
  }

  if (remotes.length > 0) {
    entries.push({ type: 'header', label: 'Releases' });
    remotes.forEach((item, i) =>
      entries.push({
        type: 'item',
        item,
        originalIndex: locals.length + i,
      }),
    );
  }

  return entries;
}

const itemListRenderer: ItemListRenderer<RunnableVersion> = ({
  filteredItems,
  renderItem,
  itemsParentRef,
}) => {
  const InnerElement = React.forwardRef((props, ref: React.Ref<Menu>) => {
    return <Menu ref={ref} ulRef={itemsParentRef} {...props} />;
  });
  InnerElement.displayName = 'Menu';

  const entries = buildListEntries(filteredItems);

  return (
    <FixedSizeList
      innerElementType={InnerElement}
      height={300}
      width={400}
      itemCount={entries.length}
      itemSize={ITEM_HEIGHT}
      itemData={{ renderItem, entries }}
    >
      {FixedSizeListItem}
    </FixedSizeList>
  );
};

/**
 * Helper method: Returns the <Select /> label for an Electron
 * version.
 */
export function getItemLabel({ source, state }: RunnableVersion): string {
  // If a version is local, show its availability state.
  if (source === VersionSource.local) {
    return state === InstallState.missing ? 'Unavailable' : 'Local Build';
  }

  const installStateLabels: Record<InstallState, string> = {
    missing: 'Not Downloaded',
    downloading: 'Downloading',
    downloaded: 'Downloaded',
    installing: 'Downloaded',
    installed: 'Downloaded',
  } as const;
  return installStateLabels[state] || '';
}

/**
 * Helper method: Returns the <Select /> icon for an Electron
 * version.
 */
export function getItemIcon({ source, state }: RunnableVersion): IconName {
  // If a version is local, either it's there or it's not.
  if (source === VersionSource.local) {
    return state === InstallState.missing ? 'issue' : 'saved';
  }

  const installStateIcons: Record<InstallState, IconName> = {
    missing: 'cloud',
    downloading: 'cloud-download',
    downloaded: 'compressed',
    installing: 'compressed',
    installed: 'saved',
  } as const;

  return installStateIcons[state] || '';
}

/**
 * Helper method: Returns the <Select /> predicate for an Electron
 * version.
 *
 * Sorts by index of the chosen query.
 * For example, if we take the following versions:
 * [3.0.0, 14.3.0, 13.2.0, 12.0.0-nightly.20210301, 12.0.0-beta.3]
 * and a search query of '3', this method would sort them into:
 * [3.0.0, 13.2.0, 14.3.0, 12.0.0-beta.3, 12.0.0-nightly.20210301]
 */
export const filterItems: ItemListPredicate<RunnableVersion> = (
  query,
  versions,
) => {
  if (query === '') return versions;

  const q = query.toLowerCase();

  return versions
    .map((version: RunnableVersion) => {
      const lowercase = version.version.toLowerCase();
      // For local versions, also search by name
      const nameMatch =
        version.source === VersionSource.local && version.name
          ? version.name.toLowerCase().indexOf(q)
          : -1;
      const versionIndex = lowercase.indexOf(q);
      // Use best match (name or version string)
      const index = nameMatch !== -1 ? nameMatch : versionIndex;
      return {
        index,
        coerced: semver.coerce(lowercase),
        version,
      };
    })
    .filter((item) => item.index !== -1)
    .sort((a, b) => {
      // Local versions always sort first
      const aLocal = a.version.source === VersionSource.local;
      const bLocal = b.version.source === VersionSource.local;
      if (aLocal && !bLocal) return -1;
      if (!aLocal && bLocal) return 1;

      // If the user is searching for e.g. 'nightly' we
      // want to sort nightlies by descending major version.
      if (isNaN(+q)) {
        if (a.coerced && b.coerced) {
          return semver.rcompare(a.coerced, b.coerced);
        }
      }
      return a.index - b.index;
    })
    .map((item) => item.version);
};

/**
 * Renders a context menu to copy the current Electron version.
 *
 * @param version - the Electron version number to copy.
 */
export const renderVersionContextMenu = (
  e: React.MouseEvent<HTMLButtonElement>,
  version: string,
) => {
  e.preventDefault();

  ContextMenu.show(
    <Menu>
      <MenuItem
        text="Copy Version Number"
        onClick={() => {
          navigator.clipboard.writeText(version);
        }}
      />
    </Menu>,
    { left: e.clientX, top: e.clientY },
  );
};

/**
 * Helper method: Returns the <Select /> <MenuItem /> for Electron
 * versions.
 */
export const renderItem: ItemRenderer<RunnableVersion> = (
  item,
  { handleClick, modifiers, query },
) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }

  const displayText = getItemDisplayText(item);

  if (disableDownload(item.version) && item.source !== VersionSource.local) {
    return (
      <Tooltip2
        className="disabled-menu-tooltip"
        modifiers={{
          flip: { enabled: false },
          preventOverflow: { enabled: false },
          hide: { enabled: false },
        }}
        position="bottom"
        intent={Intent.PRIMARY}
        content={`Version is not available on current OS`}
      >
        <MenuItem
          active={modifiers.active}
          data-testid="disabled-menu-item"
          disabled={true}
          text={highlightText(displayText, query)}
          key={item.version}
          label={getItemLabel(item)}
          icon={getItemIcon(item)}
        />
      </Tooltip2>
    );
  }

  return (
    <MenuItem
      active={modifiers.active}
      disabled={modifiers.disabled}
      text={highlightText(displayText, query)}
      key={item.version}
      onClick={handleClick}
      label={getItemLabel(item)}
      icon={getItemIcon(item)}
    />
  );
};

interface VersionSelectState {
  value: string;
}

interface VersionSelectProps {
  appState: AppState;
  disabled?: boolean;
  currentVersion: RunnableVersion;
  onVersionSelect: (version: RunnableVersion) => void;
  buttonGroupProps?: ButtonGroupProps;
  itemDisabled?:
    | keyof RunnableVersion
    | ((item: RunnableVersion, index: number) => boolean);
}

/**
 * A dropdown allowing the selection of Electron versions. The actual
 * download is managed in the state.
 */
export const VersionSelect = observer(
  class VersionSelect extends React.Component<
    VersionSelectProps,
    VersionSelectState
  > {
    public render() {
      const { currentVersion, itemDisabled } = this.props;
      const { version } = currentVersion;

      const buttonText = getItemDisplayText(currentVersion);
      const isLocal = currentVersion.source === VersionSource.local;

      return (
        <ElectronVersionSelect
          filterable={true}
          items={this.props.appState.versionsToShow}
          itemRenderer={renderItem}
          itemListPredicate={filterItems}
          itemListRenderer={itemListRenderer}
          itemDisabled={itemDisabled}
          onItemSelect={this.props.onVersionSelect}
          noResults={<MenuItem disabled={true} text="No results." />}
          disabled={!!this.props.disabled}
        >
          <Button
            id="version-chooser"
            text={buttonText}
            icon={getItemIcon(currentVersion)}
            data-local={isLocal ? 'true' : undefined}
            onContextMenu={
              isLocal
                ? undefined
                : (e: React.MouseEvent<HTMLButtonElement>) => {
                    renderVersionContextMenu(e, version);
                  }
            }
            disabled={!!this.props.disabled}
          />
        </ElectronVersionSelect>
      );
    }
  },
);
