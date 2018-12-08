import { Button, MenuItem } from '@blueprintjs/core';
import { ItemPredicate, ItemRenderer, Select } from '@blueprintjs/select';
import { observer } from 'mobx-react';
import * as React from 'react';

import { ElectronVersion, ElectronVersionSource, ElectronVersionState } from '../../interfaces';
import { highlightText } from '../../utils/highlight-text';
import { sortedElectronMap } from '../../utils/sorted-electron-map';
import { AppState } from '../state';
import { getReleaseChannel } from '../versions';

const ElectronVersionSelect = Select.ofType<ElectronVersion>();

/**
 * Helper method: Returns the <Select /> label for an Electron
 * version.
 *
 * @param {ElectronVersion} { source, state }
 * @returns {string}
 */
function getItemLabel({ source, state }: ElectronVersion): string {
  let label = '';

  if (source === ElectronVersionSource.local) {
    label = name;
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
function getItemIcon({ state }: ElectronVersion) {
  return state === 'ready'
    ? 'saved'
    : state === 'downloading' ? 'cloud-download' : 'cloud';
}

/**
 * Helper method: Returns the <Select /> predicate for an Electron
 * version.
 *
 * @param {string} query
 * @param {ElectronVersion} { tag_name }
 * @returns
 */
const filterItem: ItemPredicate<ElectronVersion> = (query, { tag_name }) => {
  return tag_name.toLowerCase().includes(query.toLowerCase());
};

/**
 * Helper method: Returns the <Select /> <MenuItem /> for Electron
 * versions.
 *
 * @param {ElectronVersion} item
 * @param {IItemRendererProps} { handleClick, modifiers, query }
 * @returns
 */
const renderItem: ItemRenderer<ElectronVersion> = (item, { handleClick, modifiers, query }) => {
  if (!modifiers.matchesPredicate) {
      return null;
  }

  return (
    <MenuItem
      active={modifiers.active}
      disabled={modifiers.disabled}
      text={highlightText(item.tag_name, query)}
      key={item.tag_name}
      onClick={handleClick}
      label={getItemLabel(item)}
      icon={getItemIcon(item)}
    />
  );
};

export interface VersionChooserState {
  value: string;
}

export interface VersionChooserProps {
  appState: AppState;
}

/**
 * A dropdown allowing the selection of Electron versions. The actual
 * download is managed in the state.
 *
 * @class VersionChooser
 * @extends {React.Component<VersionChooserProps, VersionChooserState>}
 */
@observer
export class VersionChooser extends React.Component<VersionChooserProps, VersionChooserState> {
  constructor(props: VersionChooserProps) {
    super(props);

    this.onItemSelect = this.onItemSelect.bind(this);
  }

  /**
   * Handle change, which usually means that we'd like update
   * the selection version.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  public onItemSelect({ tag_name }: ElectronVersion) {
    this.props.appState.setVersion(tag_name);
  }

  public getItems(): Array<ElectronVersion> {
    const { versions, versionsToShow } = this.props.appState;

    return sortedElectronMap<ElectronVersion>(versions, (_key, item) => item)
      .filter((item) => !!item && versionsToShow.includes(getReleaseChannel(item)));
  }

  public render() {
    const { version, versions } = this.props.appState;
    const selectedVersion = versions[version];

    if (!selectedVersion) return null;

    return (
      <ElectronVersionSelect
        filterable={true}
        items={this.getItems()}
        itemRenderer={renderItem}
        itemPredicate={filterItem}
        onItemSelect={this.onItemSelect}
        noResults={<MenuItem disabled={true} text='No results.' />}
      >
        <Button
          className='version-chooser'
          text={`Electron v${version}`}
          icon={getItemIcon(selectedVersion)}
        />
      </ElectronVersionSelect>
    );
  }
}
