import { observer } from 'mobx-react';
import * as React from 'react';
import { IpcEvents } from '../../ipc-events';

import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';

interface ChromeMacProps {
  appState: AppState;
}

/**
 * Helper method to determine if macOS is running Big Sur or later.
 *
 * @returns Whether or not macOS is Big Sur or later.
 */
const isBigSurOrLater = () =>
  Number(require('os').release().split('.')[0]) >= 20;

@observer
export class ChromeMac extends React.Component<ChromeMacProps> {
  public handleDoubleClick = () => {
    ipcRendererManager.send(IpcEvents.CLICK_TITLEBAR_MAC);
  };

  public render() {
    if (process.platform !== 'darwin') return null;

    let className = 'chrome drag';
    if (isBigSurOrLater()) {
      className += ' big_sur_or_later';
    }

    return (
      <div className={className} onDoubleClick={this.handleDoubleClick}>
        <small>{this.props.appState.title}</small>
      </div>
    );
  }
}
