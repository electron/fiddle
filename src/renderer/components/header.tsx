import * as React from 'react';

import { Commands } from './commands';
import { AppState } from '../state';
import { Output } from './output';
import { TokenDialog } from './token-dialog';

export interface HeaderProps {
  appState: AppState;
}

/**
 * Everything above the editors, so buttons, address bar, and dialogs.
 *
 * @class Header
 * @extends {React.Component<HeaderProps, {}>}
 */
export class Header extends React.Component<HeaderProps, {}> {
  public render() {
    return (
      <header id='header'>
        <Commands key='commands' appState={this.props.appState} />
        <Output key='output' appState={this.props.appState} />
        <TokenDialog key='tokenDialog' appState={this.props.appState} />
      </header>
    );
  }
}
