import * as React from 'react';
import { observer } from 'mobx-react';
import * as Icon from '@fortawesome/react-fontawesome';
import { faTerminal, faUser } from '@fortawesome/fontawesome-free-solid';

import { Runner } from './runner';
import { VersionChooser } from './version-chooser';
import { AppState } from '../app';

export interface CommandsProps {
  appState: AppState;
}

@observer
export class Commands extends React.Component<CommandsProps, {}> {
  constructor(props: CommandsProps) {
    super(props);

    this.toggleConsole = this.toggleConsole.bind(this);
    this.showAuthDialog = this.showAuthDialog.bind(this);
  }

  public toggleConsole() {
    this.props.appState.isConsoleShowing = !this.props.appState.isConsoleShowing;
  }

  public showAuthDialog() {
    this.props.appState.isTokenDialogShowing = true;
  }

  public render() {
    const authButton = !this.props.appState.githubToken ? (
      <button className='button' onClick={this.showAuthDialog}>
        <Icon icon={faUser} />
      </button>
    ) : null;

    return (
      <div className='commands'>
        <div>
          <Runner appState={this.props.appState} />
          <VersionChooser appState={this.props.appState} />
        </div>
        <div>
          <button className='button' onClick={this.toggleConsole}>
            <Icon icon={faTerminal} />
          </button>
          {authButton}
        </div>
      </div>
    );
  }
}
