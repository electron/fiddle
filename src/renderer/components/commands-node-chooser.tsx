import { Button, ButtonGroup, MenuItem } from '@blueprintjs/core';
import { ItemPredicate, ItemRenderer, Select } from '@blueprintjs/select';
import { observer } from 'mobx-react';
import * as React from 'react';

import { ElectronVersion, NodeVersion, VersionState } from '../../interfaces';
import { highlightText } from '../../utils/highlight-text';
import { sortedNodeMap } from '../../utils/sorted-map';
import { AppState } from '../state';

const ElectronVersionSelect = Select.ofType<NodeVersion>();

/**
 * Helper method: Returns the <Select /> label for an Electron
 * version.
 *
 * @param {ElectronVersion} { source, state }
 * @returns {string}
 */
export function getItemLabel({ state }: NodeVersion): string {
  let label = '';

  if (state === VersionState.unknown) {
    label = `Not downloaded`;
  } else if (state === VersionState.ready) {
    label = `Downloaded`;
  } else if (state === VersionState.downloading) {
    label = `Downloading`;
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
export function getItemIcon({ state }: NodeVersion) {
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
export const filterItem: ItemPredicate<NodeVersion> = (query, { version }) => {
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
export const renderItem: ItemRenderer<NodeVersion> = (item, { handleClick, modifiers, query }) => {
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

export interface VersionChooserState {
  value: string;
}

export interface VersionChooserProps {
  appState: AppState;
}


export const getVersionsFromAppState = (appState: AppState) => {
  const { nodeVersions } = appState;

  return sortedNodeMap<NodeVersion>(nodeVersions, (_key, item) => item)
    .filter((item) => !!item);
};

/**
 * A dropdown allowing the selection of Electron versions. The actual
 * download is managed in the state.
 *
 * @class VersionChooser
 * @extends {React.Component<VersionChooserProps, VersionChooserState>}
 */
@observer
export class NodeVersionChooser extends React.Component<VersionChooserProps, VersionChooserState> {
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
  public onItemSelect({ version }: ElectronVersion) {
    this.props.appState.setNodeVersion(version);
  }

  public render() {
    const { currentNodeVersion, Bisector } = this.props.appState;
    const { version } = currentNodeVersion;

    return (
      <ButtonGroup>
        <ElectronVersionSelect
          filterable={true}
          items={getVersionsFromAppState(this.props.appState)}
          itemRenderer={renderItem}
          itemPredicate={filterItem}
          onItemSelect={this.onItemSelect}
          noResults={<MenuItem disabled={true} text='No results.' />}
          disabled={!!Bisector}
        >
          <Button
            className='version-chooser'
            text={`Node v${version}`}
            icon={getItemIcon(currentNodeVersion)}
            disabled={!!Bisector}
          />
        </ElectronVersionSelect>
      </ButtonGroup>
    );
  }
}
