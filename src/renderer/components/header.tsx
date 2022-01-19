import * as React from 'react';

import { AppState } from '../state';
import { Commands } from './commands';
import { WelcomeTour } from './tour-welcome';

interface HeaderProps {
  appState: AppState;
}

/**
 * Everything above the editors, so buttons and the address bar.
 *
 * @class Header
 * @extends {React.Component<HeaderProps>}
 */
export class Header extends React.Component<HeaderProps> {
  public render() {
    return (
      <>
        <header id="header">
          <Commands key="commands" appState={this.props.appState} />
        </header>
        <WelcomeTour appState={this.props.appState} />
      </>
    );
  }
}
