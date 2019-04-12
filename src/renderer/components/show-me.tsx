import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { DOCS_DEMO_COMPONENTS } from './show-me/index';

export interface ShowMeProps {
  appState: AppState;
}

/**3
 * The root component for "show me" content - the fourth helpful
 * panel.
 *
 * @class ShowMe
 * @extends {React.Component<ShowMeProps, ShowMeState>}
 */
@observer
export class ShowMe extends React.Component<ShowMeProps, {}> {
  public render() {
    const { currentDocsDemoPage: showMeName } = this.props.appState;
    const Content = DOCS_DEMO_COMPONENTS[showMeName] || DOCS_DEMO_COMPONENTS.DEFAULT;

    return (
      <div className='show-me-panel'>
        <Content appState={this.props.appState} />
      </div>
    );
  }
}
