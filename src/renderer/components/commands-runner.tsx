import * as React from 'react';

import {
  Button,
  ButtonGroup,
  ButtonProps,
  Menu,
  MenuItem,
  Spinner,
} from '@blueprintjs/core';
import { Popover2 } from '@blueprintjs/popover2';
import { observer } from 'mobx-react';

import { InstallState, VersionSource } from '../../interfaces';
import { AppState } from '../state';

interface RunnerProps {
  appState: AppState;
}

/**
 * The runner component is responsible for actually launching the fiddle
 * with Electron. It also renders the button that does so.
 */
export const Runner = observer(
  class Runner extends React.Component<RunnerProps> {
    public render() {
      const { downloaded, downloading, missing, installing, installed } =
        InstallState;
      const {
        isRunning,
        isInstallingModules,
        currentElectronVersion,
        isOnline,
      } = this.props.appState;

      const { downloadProgress, source, state } = currentElectronVersion;
      const props: ButtonProps = { disabled: true };

      if ([downloading, missing].includes(state) && !isOnline) {
        props.text = 'Offline';
        props.icon = 'satellite';
        return <Button id="button-run" {...props} type={undefined} />;
      }

      switch (state) {
        case downloading: {
          props.text = 'Downloading';
          props.icon = <Spinner size={16} value={downloadProgress} />;
          break;
        }
        case installing: {
          props.text = 'Unzipping';
          props.icon = <Spinner size={16} />;
          break;
        }
        case downloaded:
        case installed: {
          props.disabled = false;
          if (isRunning) {
            props.active = true;
            props.text = 'Stop';
            props.onClick = window.app.runner.stop;
            props.icon = 'stop';
          } else if (isInstallingModules) {
            props.text = 'Installing modules';
            props.icon = <Spinner size={16} />;
          } else {
            props.text = 'Run';
            props.onClick = () => {
              window.app.runner.run({ runFromAsar: false });
            };
            props.icon = 'play';
          }
          break;
        }
        case missing: {
          if (source === VersionSource.local) {
            props.text = 'Unavailable';
            props.icon = 'issue';
            break;
          }
        }
        default: {
          props.text = 'Checking status';
          props.icon = <Spinner size={16} />;
        }
      }
      const isAsarDisabled: boolean =
        props.disabled || isRunning || isInstallingModules;

      return (
        <ButtonGroup>
          <Button id="button-run" {...props} type={undefined} />
          <AsarButton disabled={isAsarDisabled} />
        </ButtonGroup>
      );
    }
  },
);

const AsarButton = ({ disabled }: { disabled: boolean }): JSX.Element => {
  const asarButton = (
    <Menu>
      <MenuItem
        text="Run from ASAR"
        icon="play"
        active={!disabled}
        onClick={() => {
          window.app.runner.run({ runFromAsar: true });
        }}
      />
    </Menu>
  );

  return (
    <Popover2 fill={true} content={asarButton} placement="bottom">
      <Button icon="caret-down" style={{ minWidth: 20 }} disabled={disabled} />
    </Popover2>
  );
};
