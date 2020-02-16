import { Button, IButtonGroupProps, MenuItem } from '@blueprintjs/core';
import { ItemPredicate, ItemRenderer, Select } from '@blueprintjs/select';
import { observer } from 'mobx-react';
import * as React from 'react';

import { ElectronVersion, ElectronVersionSource, ElectronVersionState } from '../../interfaces';
import { highlightText } from '../../utils/highlight-text';
import { AppState } from '../state';

const ElectronVersionSelect = Select.ofType<ElectronVersion>();

/**
 * Helper method: Returns the <Select /> label for an Electron
 * version.
 *
 * @param {ElectronVersion} { source, state }
 * @returns {string}
 */
export function getItemLabel({ source, state, name }: ElectronVersion): string {
  let label = '';

  if (source === ElectronVersionSource.local) {
    label = name || 'Local';
  } else {
    if (state === ElectronVersionState.unknown) {
      label = `Not downloaded`;
    } else if (state === ElectronVersionState.ready) {
      label = `Downloaded`;
    } else if (state === ElectronVersionState.downloading) {
      label = `Downloading`;
    }
  }

  return label;
}

/**
 * Helper method: Returns the <Select /> icon for an Electron
 * version.
 *
 * @param {ElectronVersion} { state }
 * @returns
 */
export function getItemIcon({ state }: ElectronVersion) {
  return state === 'ready'
    ? 'saved'
    : state === 'downloading' ? 'cloud-download' : 'cloud';
}

/**
 * Helper method: Returns the <Select /> predicate for an Electron
 * version.
 *
 * @param {string} query
 * @param {ElectronVersion} { version }
 * @returns
 */
export const filterItem: ItemPredicate<ElectronVersion> = (query, { version }) => {
  return version.toLowerCase().includes(query.toLowerCase());
};

/**
 * Helper method: Returns the <Select /> <MenuItem /> for Electron
 * versions.
 *
 * @param {ElectronVersion} item
 * @param {IItemRendererProps} { handleClick, modifiers, query }
 * @returns
 */
export const renderItem: ItemRenderer<ElectronVersion> = (item, { handleClick, modifiers, query }) => {
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
  currentVersion: ElectronVersion;
  onVersionSelect: (version: ElectronVersion) => void;
  buttonGroupProps?: IButtonGroupProps;
}

/**
 * A dropdown allowing the selection of Electron versions. The actual
 * download is managed in the state.
 *
 * @class VersionSelect
 * @extends {React.Component<VersionSelectProps, VersionSelectState>}
 */
@observer
export class VersionSelect extends React.Component<VersionSelectProps, VersionSelectState> {
  public render() {
    const { currentVersion } = this.props;
    const { version } = currentVersion;

    return (
      <ElectronVersionSelect
        filterable={true}
        items={this.props.appState.versionsToShow}
        itemRenderer={renderItem}
        itemPredicate={filterItem}
        onItemSelect={this.props.onVersionSelect}
        noResults={<MenuItem disabled={true} text='No results.' />}
        disabled={!!this.props.disabled}
      >
        <Button
          className='version-chooser'
          text={`Electron v${version}`}
          icon={getItemIcon(currentVersion)}
          disabled={!!this.props.disabled}
        />
      </ElectronVersionSelect>
    );
  }
}
