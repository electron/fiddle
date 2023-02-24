import * as React from 'react';

import { reaction } from 'mobx';

import { AppState } from '../state';
import { Commands } from './commands';
import { WelcomeTour } from './tour-welcome';

interface HeaderProps {
  appState: AppState;
}

interface HeaderState {
  focusable: boolean;
}

/**
 * Everything above the editors, so buttons and the address bar.
 *
 * @class Header
 * @extends {React.Component<HeaderProps>}
 */
export class Header extends React.Component<HeaderProps, HeaderState> {
  constructor(props: HeaderProps) {
    super(props);
    this.state = {
      focusable: true,
    };
    reaction(
      () => this.props.appState.isSettingsShowing,
      (isSettingsShowing) => this.setState({ focusable: !isSettingsShowing }),
    );
  }
  public render() {
    return (
      <>
        <header
          id="header"
          className={!this.state.focusable ? 'tabbing-hidden' : undefined}
        >
          <Commands key="commands" appState={this.props.appState} />
        </header>
        <WelcomeTour appState={this.props.appState} />
      </>
    );
  }
}
