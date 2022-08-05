import * as React from 'react';

import { Callout, Checkbox, FormGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';

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
export const ConsoleSettings = observer(
  class ConsoleSettings extends React.Component<ConsoleSettingsProps> {
    constructor(props: ConsoleSettingsProps) {
      super(props);

      this.handleClearOnRunChange = this.handleClearOnRunChange.bind(this);
    }

    /**
     * Handles a change on whether or not the console should be cleared
     * before fiddle is executed.
     *
     * @param {React.FormEvent<HTMLInputElement>} event
     */
    public handleClearOnRunChange(event: React.FormEvent<HTMLInputElement>) {
      const { checked } = event.currentTarget;
      this.props.appState.isClearingConsoleOnRun = checked;
    }

    public render() {
      const { isClearingConsoleOnRun } = this.props.appState;

      const clearOnRunInstructions = `
      Enable this option to automatically clear the console whenever you run your
      fiddle.`.trim();

      return (
        <div>
          <h1>Console</h1>
          <Callout>
            <FormGroup>
              <p>{clearOnRunInstructions}</p>
              <Checkbox
                checked={isClearingConsoleOnRun}
                label="Clear on run."
                onChange={this.handleClearOnRunChange}
              />
            </FormGroup>
          </Callout>
        </div>
      );
    }
  },
);
