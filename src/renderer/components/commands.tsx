import * as React from 'react';

import { Button, ControlGroup } from '@blueprintjs/core';
import classNames from 'classnames';
import { observer } from 'mobx-react';

import { GistActionButton } from './commands-action-button';
import { AddressBar } from './commands-address-bar';
import { BisectHandler } from './commands-bisect';
import { Runner } from './commands-runner';
import { VersionChooser } from './commands-version-chooser';
import { AppState } from '../state';

interface CommandsProps {
  appState: AppState;
}

/**
 * The command bar, containing all the buttons doing
 * all the things
 */
export const Commands = observer(
  class Commands extends React.Component<CommandsProps> {
    constructor(props: CommandsProps) {
      super(props);
    }

    private handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // Only maximize if the toolbar itself is clicked (ignore for buttons, input, etc)
      if (e.currentTarget === e.target) {
        window.ElectronFiddle.macTitlebarClicked();
      }
    };

    public render() {
      const { appState } = this.props;
      const { isBisectCommandShowing, title, isSettingsShowing } = appState;

      return (
        <div
          className={classNames(
            'commands',
            { 'is-mac': window.ElectronFiddle.platform === 'darwin' },
            { 'tabbing-hidden': isSettingsShowing },
          )}
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
