import * as React from 'react';

import { Divider } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { AppearanceSettings } from './settings-general-appearance';
import { BlockAcceleratorsSettings } from './settings-general-block-accelerators';
import { ConsoleSettings } from './settings-general-console';
import { FontSettings } from './settings-general-font';
import { GitHubSettings } from './settings-general-github';
import { MirrorSettings } from './settings-general-mirror';
import { PackageAuthorSettings } from './settings-general-package-author';

interface GeneralSettingsProps {
  appState: AppState;
  toggleHasPopoverOpen: () => void;
}

/**
 * Settings content to manage GitHub-related preferences.
 *
 * @class GitHubSettings
 * @extends {React.Component<GeneralSettingsProps>}
 */
export const GeneralSettings = observer(
  class GeneralSettings extends React.Component<GeneralSettingsProps> {
    public render() {
      return (
        <div>
          <h1>General Settings</h1>
          <AppearanceSettings
            appState={this.props.appState}
            toggleHasPopoverOpen={() => this.props.toggleHasPopoverOpen()}
          />
          <Divider />
          <FontSettings appState={this.props.appState} />
          <Divider />
          <ConsoleSettings appState={this.props.appState} />
          <Divider />
          <GitHubSettings appState={this.props.appState} />
          <Divider />
          <BlockAcceleratorsSettings appState={this.props.appState} />
          <Divider />
          <PackageAuthorSettings appState={this.props.appState} />
          <Divider />
          <MirrorSettings appState={this.props.appState} />
        </div>
      );
    }
  },
);
