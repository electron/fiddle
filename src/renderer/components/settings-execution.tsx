import { Callout, Card, Checkbox, FormGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';

export interface ExecutionSettingsProps {
  appState: AppState;
}

/**
 * Settings content to manage execution-related preferences.
 *
 * @class ExecutionSettings
 * @extends {React.Component<ExecutionSettingsProps, {}>}
 */
@observer
export class ExecutionSettings extends React.Component<ExecutionSettingsProps, {}> {
  constructor(props: ExecutionSettingsProps) {
    super(props);

    this.handleDeleteDataChange = this.handleDeleteDataChange.bind(this);
  }

  /**
   * Handles a change on whether or not the user data dir should be deleted
   * after a run.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleDeleteDataChange(
    event: React.FormEvent<HTMLInputElement>
  ) {
    const { checked } = event.currentTarget;
    this.props.appState.isKeepingUserDataDirs = checked;
  }

  public render() {
    const { isKeepingUserDataDirs } = this.props.appState;
    const deleteUserDirLabel = `
      Whenever Electron runs, it creates a user data directory for cookies, the cache,
      and various other things that it needs to keep around. Since fiddles are usually
      just run once, we delete this directory after your fiddle exits. Enable this
      setting to keep the user data directories around.
    `.trim();

    return (
      <div>
        <h2>Exection</h2>
        <Callout>
          These advanced settings control how Electron Fiddle executes your fiddles.
        </Callout>
        <br />
        <Callout>
        <FormGroup label={deleteUserDirLabel}>
          <Checkbox
            checked={isKeepingUserDataDirs}
            label='Do not delete user data directories.'
            onChange={this.handleDeleteDataChange}
          />
        </FormGroup>
      </Callout>
      </div>
    );
  }
}
