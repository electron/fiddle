import * as React from 'react';

import { Commands } from './commands';
import { WelcomeTour } from './tour-welcome';
import { AppState } from '../state';

interface HeaderProps {
  appState: AppState;
}

interface HeaderState {
  focusable: boolean;
}

/**
 * Everything above the editors, so buttons and the address bar.
 */
export class Header extends React.Component<HeaderProps, HeaderState> {
  constructor(props: HeaderProps) {
    super(props);
  }

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
