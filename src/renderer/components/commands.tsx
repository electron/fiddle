import * as React from 'react';

import { Button, ControlGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { IpcEvents } from '../../ipc-events';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';
import { GistActionButton } from './commands-action-button';
import { AddressBar } from './commands-address-bar';
import { BisectHandler } from './commands-bisect';
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
export const Commands = observer(
  class Commands extends React.Component<CommandsProps> {
    constructor(props: CommandsProps) {
      super(props);
    }

    private handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // Only maximize if the toolbar itself is clicked (ignore for buttons, input, etc)
      if (e.currentTarget === e.target) {
        ipcRendererManager.send(IpcEvents.CLICK_TITLEBAR_MAC);
      }
    };

    public render() {
      const { appState } = this.props;
      const { isBisectCommandShowing, title } = appState;

      return (
        <div
          className={
            window.ElectronFiddle.platform === 'darwin'
              ? 'commands is-mac'
              : 'commands'
          }
          onDoubleClick={this.handleDoubleClick}
        >
          <div>
            <ControlGroup fill={true} vertical={false}>
              <Button
                icon="cog"
                title="Setting"
                onClick={appState.toggleSettings}
              />
            </ControlGroup>
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
          {window.ElectronFiddle.platform === 'darwin' ? (
            <div className="title">{title}</div>
          ) : undefined}
          <div>
            <AddressBar appState={appState} />
            <GistActionButton appState={appState} />
          </div>
        </div>
      );
    }
  },
);
