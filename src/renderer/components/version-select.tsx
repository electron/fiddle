import * as React from 'react';

import {
  Button,
  ButtonGroupProps,
  ContextMenu,
  Intent,
  Menu,
  MenuItem,
  Tooltip,
} from '@blueprintjs/core';
import {
  ItemListPredicate,
  ItemListRenderer,
  ItemRenderer,
  Select,
} from '@blueprintjs/select';
import { InstallState } from '@vertedinde/fiddle-core';
import { clipboard } from 'electron';
import { observer } from 'mobx-react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import semver from 'semver';

import { RunnableVersion, VersionSource } from '../../interfaces';
import { disableDownload } from '../../utils/disable-download';
import { highlightText } from '../../utils/highlight-text';
import { AppState } from '../state';

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
 *
 * @param {RunnableVersion} { source, state, name }
 * @returns {string}
 */
export function getItemLabel({ source, state, name }: RunnableVersion): string {
  let label = '';

  if (source === VersionSource.local) {
    label = name || 'Local';
  } else {
    if (state === InstallState.missing) {
      label = `Not downloaded`;
    } else if (
      state === InstallState.installed ||
      state === InstallState.downloaded
    ) {
      label = `Downloaded`;
    } else if (state === InstallState.downloading) {
      label = `Downloading`;
    }
  }

  return label;
}

/**
 * Helper method: Returns the <Select /> icon for an Electron
 * version.
 *
 * @param {RunnableVersion} { state }
 * @returns
 */
export function getItemIcon({ state }: RunnableVersion) {
  switch (state) {
    case InstallState.missing:
      return 'cloud';
    case InstallState.installing:
      return 'compressed';
    case InstallState.installed:
    case InstallState.downloaded:
      return 'saved';
    case InstallState.downloading:
      return 'cloud-download';
  }
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
 *
 * @param {string} query
 * @param {RunnableVersion[]} versions
 * @returns
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
 * @param {React.MouseEvent<HTMLButtonElement>} e
 * @param {string} version the Electron version number to copy.
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
          clipboard.writeText(version);
        }}
      />
    </Menu>,
    { left: e.clientX, top: e.clientY },
  );
};

/**
 * Helper method: Returns the <Select /> <MenuItem /> for Electron
 * versions.
 *
 * @param {RunnableVersion} item
 * @param {IItemRendererProps} { handleClick, modifiers, query }
 * @returns
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
      <Tooltip
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
          disabled={true}
          text={highlightText(item.version, query)}
          key={item.version}
          label={getItemLabel(item)}
          icon={getItemIcon(item)}
        />
      </Tooltip>
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
 *
 * @class VersionSelect
 * @extends {React.Component<VersionSelectProps, VersionSelectState>}
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
            className="version-chooser"
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
