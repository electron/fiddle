import * as React from 'react';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { getTitle } from '../../utils/get-title';

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
