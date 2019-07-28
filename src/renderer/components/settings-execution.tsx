import { Callout, Checkbox, FormGroup } from '@blueprintjs/core';
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
    this.handleElectronLoggingChange = this.handleElectronLoggingChange.bind(this);
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

  /**
   * Handles a change on whether or not electron should log more things
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleElectronLoggingChange(
    event: React.FormEvent<HTMLInputElement>
  ) {
    const { checked } = event.currentTarget;
    this.props.appState.isEnablingElectronLogging = checked;
  }

  public render() {
    const { isKeepingUserDataDirs, isEnablingElectronLogging } = this.props.appState;

    const deleteUserDirLabel = `
      Whenever Electron runs, it creates a user data directory for cookies, the cache,
      and various other things that it needs to keep around. Since fiddles are usually
      just run once, we delete this directory after your fiddle exits. Enable this
      setting to keep the user data directories around.
    `.trim();
    const electronLoggingLabel = `
      There are some flags that Electron uses to log extra information both internally
      and through Chromium.  Enable this option to make Fiddle produce those logs.`.trim();

    return (
      <div>
        <h2>Execution</h2>
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
        <br />
        <Callout>
          <FormGroup label={electronLoggingLabel}>
            <Checkbox
              checked={isEnablingElectronLogging}
              label='Enable advanced Electron logging.'
              onChange={this.handleElectronLoggingChange}
            />
          </FormGroup>
        </Callout>
      </div>
    );
  }
}
