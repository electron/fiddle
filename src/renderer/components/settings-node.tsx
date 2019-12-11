import {
  Callout,
  Checkbox,
  FormGroup,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { ElectronReleaseChannel } from '../versions';

export interface NodeSettingsProps {
  appState: AppState;
}

export interface NodeSettingsState {
}

/**
 * Settings content to manage Electron-related preferences.
 *
 * @class NodeSettings
 * @extends {React.Component<NodeSettingsProps, {}>}
 */
@observer
export class NodeSettings extends React.Component<NodeSettingsProps, NodeSettingsState> {
  constructor(props: NodeSettingsProps) {
    super(props);

    this.handleShowNodeChange = this.handleShowNodeChange.bind(this);
  }

  /**
   * Handles a change in which channels should be displayed.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleShowNodeChange(
    event: React.FormEvent<HTMLInputElement>
  ) {
    const { checked } = event.currentTarget;
    const { appState } = this.props;

    appState.isShowingNodeVersions = checked;
  }

  public render() {
    return (
      <div className='settings-electron'>
        <h2>Electron Settings</h2>
        <Callout>
          {this.renderDisplayOptions()}
        </Callout>
      </div>
    );
  }

  /**
   * Renders the various options for which versions should be displayed
   *
   * @private
   * @returns {JSX.Element}
   */
  private renderDisplayOptions(): JSX.Element {
    const { appState } = this.props;

    return (
      <FormGroup>
        <Checkbox
          checked={appState.isShowingNodeVersions}
          label='Include Node versions'
          id='node-versions'
          onChange={this.handleShowNodeChange}
          inline={true}
        />
      </FormGroup>
    );
  }
}
