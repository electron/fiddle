import * as React from 'react';

import { AppState } from '../state';
import { TokenDialog } from './token-dialog';

export interface DialogsProps {
  appState: AppState;
}

/**
 * Dialogs (like the GitHub PAT input).
 *
 * @class Dialogs
 * @extends {React.Component<DialogsProps, {}>}
 */
export class Dialogs extends React.Component<DialogsProps, {}> {
  public render() {
    return (
      <div key='dialogs' className='dialogs'>
        <TokenDialog key='dialogs' appState={this.props.appState} />
      </div>
    );
  }
}
