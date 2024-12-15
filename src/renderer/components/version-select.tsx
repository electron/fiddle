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

const ElectronVersionSelect = Select.ofType<RunnableVersion>();

const FixedSizeListItem = ({ index, data, style }: ListChildComponentProps) => {
  const { filteredItems, renderItem } = data;
  const renderedItem = renderItem(filteredItems[index], index);

  return <div style={style}>{renderedItem}</div>;
};

const itemListRenderer: ItemListRenderer<RunnableVersion> = ({
  filteredItems,
  renderItem,
  itemsParentRef,
}) => {
  const InnerElement = React.forwardRef((props, ref: React.RefObject<Menu>) => {
    return <Menu ref={ref} ulRef={itemsParentRef} {...props} />;
  });
  InnerElement.displayName = 'Menu';

  return (
    <FixedSizeList
      innerElementType={InnerElement}
      height={300}
      width={400}
      itemCount={filteredItems.length}
      itemSize={30}
      itemData={{ renderItem, filteredItems }}
    >
      {FixedSizeListItem}
    </FixedSizeList>
  );
};

/**
 * Helper method: Returns the <Select /> label for an Electron
 * version.
 */
export function getItemLabel({ source, state, name }: RunnableVersion): string {
  // If a version is local, either it's there or it's not.
  if (source === VersionSource.local) {
    return state === InstallState.missing ? 'Unavailable' : name || 'Local';
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
      return {
        index: lowercase.indexOf(q),
        coerced: semver.coerce(lowercase),
        version,
      };
    })
    .filter((item) => item.index !== -1)
    .sort((a, b) => {
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

  if (disableDownload(item.version)) {
    return (
      <Tooltip2
        className="disabled-menu-tooltip"
        modifiers={{
          flip: { enabled: false },
          preventOverflow: { enabled: false },
          hide: { enabled: false },
        }}
        intent={Intent.PRIMARY}
        content={`Version is not available on current OS`}
      >
        <MenuItem
          active={modifiers.active}
          data-testid="disabled-menu-item"
          disabled={true}
          text={highlightText(item.version, query)}
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
      text={highlightText(item.version, query)}
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
            text={`Electron v${version}`}
            icon={getItemIcon(currentVersion)}
            onContextMenu={(e: React.MouseEvent<HTMLButtonElement>) => {
              renderVersionContextMenu(e, version);
            }}
            disabled={!!this.props.disabled}
          />
        </ElectronVersionSelect>
      );
    }
  },
);
