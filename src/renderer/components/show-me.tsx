import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';

export interface ShowMeProps {
  appState: AppState;
}

/**
 * The root component for "show me" content - the fourth helpful
 * panel.
 *
 * @class ShowMe
 * @extends {React.Component<ShowMeProps, ShowMeState>}
 */
@observer
export class ShowMe extends React.Component<ShowMeProps, {}> {
  public render() {
    const { templateName } = this.props.appState;

    return (
      <div className='show-me-panel'>
        <h2>What's {templateName}?</h2>
        <p className='bp3r-running-text'>
          We're just trying to help.
        </p>
      </div>
    );
  }
}
