import { Button, ControlGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { AddressBar } from './commands-address-bar';
import { BisectHandler } from './commands-bisect';
import { GistActionButton } from './commands-action-button';
import { Runner } from './commands-runner';
import { VersionChooser } from './commands-version-chooser';

interface CommandsProps {
  appState: AppState;
}

/**
 * The command bar, containing all the buttons doing
 * all the things
 *
 * @class Commands
 * @extends {React.Component<CommandsProps>}
 */
@observer
export class Commands extends React.Component<CommandsProps> {
  constructor(props: CommandsProps) {
    super(props);
  }

  public render() {
    const { appState } = this.props;
    const { isBisectCommandShowing: isBisectCommandShowing } = appState;

    return (
      <div className="commands">
        <div>
          <ControlGroup fill={true} vertical={false}>
            <VersionChooser appState={appState} />
            <Runner appState={appState} />
          </ControlGroup>
          {isBisectCommandShowing && (
            <ControlGroup fill={true} vertical={false}>
              <BisectHandler appState={appState} />
            </ControlGroup>
          )}
          <ControlGroup fill={true} vertical={false}>
            <Button
              active={appState.isConsoleShowing}
              icon="console"
              text="Console"
              onClick={appState.toggleConsole}
            />
          </ControlGroup>
        </div>
        <div>
          <AddressBar appState={appState} />
          <GistActionButton appState={appState} />
        </div>
      </div>
    );
  }
}
