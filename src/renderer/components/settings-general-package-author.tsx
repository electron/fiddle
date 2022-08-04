import * as React from 'react';

import { Callout, FormGroup, InputGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { AppState } from '../state';

interface PackageAuthorSettingsProps {
  appState: AppState;
}

interface IPackageAuthorSettingsState {
  value: string;
}

/**
 * Settings package.json author info
 *
 * @class PackageAuthorSettings
 * @extends {React.Component<PackageAuthorSettingsProps, IPackageAuthorSettingsState>}
 */
export const PackageAuthorSettings = observer(
  class PackageAuthorSettings extends React.Component<
    PackageAuthorSettingsProps,
    IPackageAuthorSettingsState
  > {
    constructor(props: PackageAuthorSettingsProps) {
      super(props);

      this.state = {
        value: this.props.appState.packageAuthor,
      };

      this.handlePackageAuthorChange = this.handlePackageAuthorChange.bind(
        this,
      );
    }

    /**
     * Set the author information in package.json when processing uploads to gist
     *
     * @param {React.ChangeEvent<HTMLInputElement>} event
     */
    public handlePackageAuthorChange(event: React.FormEvent<HTMLInputElement>) {
      const { value } = event.currentTarget;

      this.setState({
        value,
      });

      this.props.appState.packageAuthor = value;
    }

    public render() {
      const packageAuthorLabel =
        'Set the package.json author field for your exported Fiddle projects.';

      return (
        <div>
          <h4>Package Author</h4>
          <Callout>
            <FormGroup label={packageAuthorLabel} labelFor="package-author">
              <InputGroup
                id="package-author"
                value={this.state.value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  this.handlePackageAuthorChange(e)
                }
              />
            </FormGroup>
          </Callout>
        </div>
      );
    }
  },
);
