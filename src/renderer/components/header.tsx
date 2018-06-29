import * as React from 'react';

import { Commands } from './commands';
import { AppState } from '../state';
import { Output } from './output';
import { ChromeMac } from './chrome-mac';

export interface HeaderProps {
  appState: AppState;
}

/**
 * Everything above the editors, so buttons and the address bar.
 *
 * @class Header
 * @extends {React.Component<HeaderProps, {}>}
 */
export class Header extends React.Component<HeaderProps, {}> {
  public render() {
    return (
      <>
        <ChromeMac appState={this.props.appState} />
        <header id='header'>
          <Commands key='commands' appState={this.props.appState} />
          <Output key='output' appState={this.props.appState} />
        </header>
      </>
    );
  }
}
