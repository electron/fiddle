import * as React from 'react';

import { Callout, Checkbox, FormGroup, InputGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { AppState } from '../state';

interface GistSettingsProps {
  appState: AppState;
}

interface IGistSettingsState {
  packageAuthor: string;
  isShowingGistHistory: boolean;
}

/**
 * Settings package.json author info
 */
export const GistSettings = observer(
  class GistSettings extends React.Component<
    GistSettingsProps,
    IGistSettingsState
  > {
    constructor(props: GistSettingsProps) {
      super(props);

      this.state = {
        packageAuthor: this.props.appState.packageAuthor,
        isShowingGistHistory: this.props.appState.isShowingGistHistory,
      };

      this.handlePackageAuthorChange =
        this.handlePackageAuthorChange.bind(this);
      this.handleGistHistoryChange = this.handleGistHistoryChange.bind(this);
    }

    /**
     * Set the author information in package.json when processing uploads to gist.
     */
    public handlePackageAuthorChange(event: React.FormEvent<HTMLInputElement>) {
      const { value } = event.currentTarget;

      this.setState({ packageAuthor: value });

      this.props.appState.packageAuthor = value;
    }

    /**
     * Toggle the visibility of the Gist history.
     */
    public handleGistHistoryChange = (
      event: React.FormEvent<HTMLInputElement>,
    ) => {
      const { checked } = event.currentTarget;

      this.setState({ isShowingGistHistory: checked });

      this.props.appState.isShowingGistHistory = checked;
    };

    public render() {
      const PackageAuthorDescription =
        'Set the package.json author field for your exported Fiddle projects.';
      const GistHistoryDescription =
        'Show the history of your Gist uploads and optionally load previous revisions.';

      return (
        <div>
          <h4>Gists</h4>
          <Callout>
            <FormGroup>
              <p>{PackageAuthorDescription}</p>
              <InputGroup
                value={this.state.packageAuthor}
                onChange={this.handlePackageAuthorChange}
              />
              <p>{GistHistoryDescription}</p>
              <Checkbox
                checked={this.state.isShowingGistHistory}
                label="Show Gist History"
                onChange={this.handleGistHistoryChange}
              />
            </FormGroup>
          </Callout>
        </div>
      );
    }
  },
);
