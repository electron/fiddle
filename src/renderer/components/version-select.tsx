import { Button, IButtonGroupProps, MenuItem } from '@blueprintjs/core';
import { ItemPredicate, ItemRenderer, Select } from '@blueprintjs/select';
import { observer } from 'mobx-react';
import * as React from 'react';

import { RunnableVersion, VersionSource, VersionState } from '../../interfaces';
import { highlightText } from '../../utils/highlight-text';
import { AppState } from '../state';

const ElectronVersionSelect = Select.ofType<RunnableVersion>();

/**
 * Helper method: Returns the <Select /> label for an Electron
 * version.
 *
 * @param {RunnableVersion} { source, state }
 * @returns {string}
 */
export function getItemLabel({ source, state, name }: RunnableVersion): string {
  let label = '';

  if (source === VersionSource.local) {
    label = name || 'Local';
  } else {
    if (state === VersionState.unknown) {
      label = `Not downloaded`;
    } else if (state === VersionState.ready) {
      label = `Downloaded`;
    } else if (state === VersionState.downloading) {
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
  return state === 'ready'
    ? 'saved'
    : state === 'downloading'
    ? 'cloud-download'
    : 'cloud';
}

/**
 * Helper method: Returns the <Select /> predicate for an Electron
 * version.
 *
 * @param {string} query
 * @param {RunnableVersion} { version }
 * @returns
 */
export const filterItem: ItemPredicate<RunnableVersion> = (
  query,
  { version },
) => {
  return version.toLowerCase().includes(query.toLowerCase());
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

export interface VersionSelectState {
  value: string;
}

export interface VersionSelectProps {
  appState: AppState;
  disabled?: boolean;
  currentVersion: RunnableVersion;
  onVersionSelect: (version: RunnableVersion) => void;
  buttonGroupProps?: IButtonGroupProps;
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
@observer
export class VersionSelect extends React.Component<
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
        itemPredicate={filterItem}
        itemDisabled={itemDisabled}
        onItemSelect={this.props.onVersionSelect}
        noResults={<MenuItem disabled={true} text="No results." />}
        disabled={!!this.props.disabled}
      >
        <Button
          className="version-chooser"
          text={`Electron v${version}`}
          icon={getItemIcon(currentVersion)}
          disabled={!!this.props.disabled}
        />
      </ElectronVersionSelect>
    );
  }
}
