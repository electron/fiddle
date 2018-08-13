import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { AppearanceSettings } from './settings-general-appearance';
import { GitHubSettings } from './settings-general-github';

export interface GeneralSettingsProps {
  appState: AppState;
}

/**
 * Settings content to manage GitHub-related preferences.
 *
 * @class GitHubSettings
 * @extends {React.Component<GeneralSettingsProps, {}>}
 */
@observer
export class GeneralSettings extends React.Component<GeneralSettingsProps, {}> {
  public render() {
    return (
      <div>
        <h2>General Settings</h2>
        <AppearanceSettings appState={this.props.appState} />
        <hr />
        <GitHubSettings appState={this.props.appState} />
      </div>
    );
  }
}
