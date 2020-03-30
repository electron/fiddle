import { remote } from 'electron';
import { observer } from 'mobx-react';
import * as React from 'react';

import { getTitle } from '../../utils/get-title';
import { AppState } from '../state';

export interface ChromeMacProps {
  appState: AppState;
}

@observer
export class ChromeMac extends React.Component<ChromeMacProps> {
  public handleDoubleClick = () => {
    const doubleClickAction = remote.systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    const win = remote.getCurrentWindow();
    if (doubleClickAction === 'Minimize') {
      win.minimize();
    } else if (doubleClickAction === 'Maximize') {
      if (!win.isMaximized()) {
        win.maximize();
      } else {
        win.unmaximize();
      }
    }
  }

  public render() {
    if (process.platform !== 'darwin') return null;

    return (
      <div className='chrome drag' onDoubleClick={this.handleDoubleClick}>
        <small>{getTitle(this.props.appState)}</small>
      </div>
    );
  }
}
