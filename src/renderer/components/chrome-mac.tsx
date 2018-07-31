import { observer } from 'mobx-react';
import * as React from 'react';

import { getTitle } from '../../utils/get-title';
import { AppState } from '../state';

export interface ChromeMacProps {
  appState: AppState;
}

@observer
export class ChromeMac extends React.Component<ChromeMacProps> {
  public render() {
    if (process.platform !== 'darwin') return null;

    return (
      <div className='chrome drag'>
        <small>{getTitle(this.props.appState)}</small>
      </div>
    );
  }
}
