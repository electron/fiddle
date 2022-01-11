import { Button, ButtonProps, Spinner } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { VersionState } from '../../interfaces';
import { AppState } from '../state';

interface RunnerProps {
  appState: AppState;
}

/**
 * The runner component is responsible for actually launching the fiddle
 * with Electron. It also renders the button that does so.
 *
 * @class Runner
 * @extends {React.Component<RunnerProps>}
 */
@observer
export class Runner extends React.Component<RunnerProps> {
  public render() {
    const { downloading, unknown, unzipping, ready } = VersionState;
    const {
      isRunning,
      isInstallingModules,
      currentElectronVersion,
      isOnline,
    } = this.props.appState;

    const state = currentElectronVersion?.state;
    const props: ButtonProps = { className: 'button-run', disabled: true };

    if ([downloading, unknown].includes(state) && !isOnline) {
      props.text = 'Offline';
      props.icon = 'satellite';
      return <Button {...props} type={undefined} />;
    }

    switch (state) {
      case downloading: {
        props.text = 'Downloading';
        props.icon = (
          <Spinner size={16} value={currentElectronVersion?.downloadProgress} />
        );
        break;
      }
      case unzipping: {
        props.text = 'Unzipping';
        props.icon = <Spinner size={16} />;
        break;
      }
      case ready: {
        props.disabled = false;
        if (isRunning) {
          props.active = true;
          props.text = 'Stop';
          props.onClick = window.ElectronFiddle.app.runner.stop;
          props.icon = 'stop';
        } else if (isInstallingModules) {
          props.text = 'Installing modules';
          props.icon = <Spinner size={16} />;
        } else {
          props.text = 'Run';
          props.onClick = window.ElectronFiddle.app.runner.run;
          props.icon = 'play';
        }
        break;
      }
      default: {
        props.text = 'Checking status';
        props.icon = <Spinner size={16} />;
      }
    }

    return <Button {...props} type={undefined} />;
  }
}
