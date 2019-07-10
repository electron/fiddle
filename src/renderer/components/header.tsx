import * as React from 'react';

import { AppState } from '../state';
import { ChromeMac } from './chrome-mac';
import { Commands } from './commands';
import { WelcomeTour } from './tour-welcome';

export interface HeaderProps {
  appState: AppState;
}

/**
 * Everything above the editors, so buttons and the address bar.
 *
 * @class Header
 * @extends {React.Component<HeaderProps, HeaderState>}
 */
export class Header extends React.Component<HeaderProps, {}> {
  public render() {
    return (
      <>
        <ChromeMac appState={this.props.appState} />
        <header id='header'>
          <Commands key='commands' appState={this.props.appState} />
        </header>
        <WelcomeTour appState={this.props.appState} />
      </>
    );
  }
}
