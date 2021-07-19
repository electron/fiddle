import { Callout, Checkbox, FormGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';

interface ConsoleSettingsProps {
  appState: AppState;
}

/**
 * Settings content to manage console-related preferences.
 *
 * @class ConsoleSettings
 * @extends {React.Component<ConsoleSettingsProps>}
 */
@observer
export class ConsoleSettings extends React.Component<ConsoleSettingsProps> {
  constructor(props: ConsoleSettingsProps) {
    super(props);

    this.handleClearOnRunChange = this.handleClearOnRunChange.bind(this);
    this.handleShowTimestampChange = this.handleShowTimestampChange.bind(this);
  }

  /**
   * Handles a change on whether or not the console should be cleared
   * before fiddle is executed.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleClearOnRunChange(event: React.FormEvent<HTMLInputElement>) {
    const { checked } = event.currentTarget;
    this.props.appState.isClearingConsoleOnRun = checked;
  }

  /**
   * Handles a change on whether or not the console timestamps should be shown
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleShowTimestampChange(event: React.FormEvent<HTMLInputElement>) {
    const { checked } = event.currentTarget;
    this.props.appState.isShowingTimestamp = checked;
  }

  public render() {
    const { isClearingConsoleOnRun, isShowingTimestamp } = this.props.appState;

    const clearOnRunLabel = `
      Enable this option to automatically clear the console whenever you run your
      fiddle.`.trim();

    const showTimestampLabel = `
      Enable this option to show timestamps for each log entry within the console.`.trim();

    return (
      <div>
        <h4>Console</h4>
        <Callout>
          <FormGroup label={clearOnRunLabel}>
            <Checkbox
              checked={isClearingConsoleOnRun}
              label="Clear on run."
              onChange={this.handleClearOnRunChange}
            />
          </FormGroup>
          <FormGroup label={showTimestampLabel}>
            <Checkbox
              checked={isShowingTimestamp}
              label="Show Console Timestamps."
              onChange={this.handleShowTimestampChange}
            />
          </FormGroup>
        </Callout>
      </div>
    );
  }
}
