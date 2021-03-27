import { observer } from 'mobx-react';
import * as React from 'react';
import { IpcEvents } from '../../ipc-events';

import { getTitle } from '../../utils/get-title';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';

interface ChromeMacProps {
  appState: AppState;
}

@observer
export class ChromeMac extends React.Component<ChromeMacProps> {
  public handleDoubleClick = () => {
    ipcRendererManager.send(IpcEvents.CLICK_TITLEBAR_MAC);
  };

  public render() {
    if (process.platform !== 'darwin') return null;

    return (
      <div className="chrome drag" onDoubleClick={this.handleDoubleClick}>
        <small>{getTitle(this.props.appState)}</small>
      </div>
    );
  }
}
