import { observer } from 'mobx-react';
import * as React from 'react';
import * as fs from 'fs';
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
const isBigSurOrLater = () => {
  const file = '/System/Library/CoreServices/SystemVersion.plist';
  if (!fs.existsSync(file)) return false;

  const plist = fs.readFileSync(file, 'utf8');
  const matches = /<key>ProductVersion<\/key>\s*<string>([\d.]+)<\/string>/.exec(
    plist,
  );

  if (!matches) return false;

  const version = matches[1].replace('10.16', '11');

  return parseInt(version, 10) >= 11;
};

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
