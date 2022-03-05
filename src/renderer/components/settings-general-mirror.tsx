import { observer } from 'mobx-react';
import * as React from 'react';
import { AppState } from '../state';
import {
  Button,
  Callout,
  FormGroup,
  InputGroup,
  Menu,
  MenuItem,
} from '@blueprintjs/core';
import { Popover2 } from '@blueprintjs/popover2';
import { ELECTRON_MIRRORS } from '../mirror-constants';

interface MirrorSettingsProps {
  appState: AppState;
}

interface IMirrorSettingsState {
  electronMirror: string;
  electronNightlyMirror: string;
}

/**
 * Settings electron mirror
 *
 * @class MirrorSettings
 * @extends {React.Component<MirrorSettingsProps, IMirrorSettingsState>}
 */
@observer
export class MirrorSettings extends React.Component<
  MirrorSettingsProps,
  IMirrorSettingsState
> {
  constructor(props: MirrorSettingsProps) {
    super(props);

    this.state = {
      ...props.appState.electronMirrors,
    };
  }

  private setMirror(isNightly: boolean, value: string) {
    if (isNightly) {
      this.setState({
        electronNightlyMirror: value,
      });
      this.props.appState.electronMirrors.electronNightlyMirror = value;
    } else {
      this.setState({
        electronMirror: value,
      });
      this.props.appState.electronMirrors.electronMirror = value;
    }
  }

  private selectMirrorMenu(isNightly: boolean) {
    const mirrorKey = isNightly ? 'electronNightlyMirror' : 'electronMirror';
    return (
      <Popover2
        content={
          <Menu>
            <MenuItem
              text="Default"
              onClick={() => {
                this.setMirror(isNightly, ELECTRON_MIRRORS.DEFAULT[mirrorKey]);
              }}
            />
            <MenuItem
              text="China"
              onClick={() => {
                this.setMirror(isNightly, ELECTRON_MIRRORS.CHINA[mirrorKey]);
              }}
            />
          </Menu>
        }
        placement="bottom-end"
      >
        <Button minimal={true} rightIcon="caret-down">
          Select {isNightly ? 'Nightly' : ''} Mirror
        </Button>
      </Popover2>
    );
  }

  public render() {
    const electronMirrorsLabel =
      'Set the base URL of the mirror(nightly) to download from.';

    return (
      <div>
        <h4>ELectron Mirrors</h4>
        <Callout>
          <FormGroup label={electronMirrorsLabel}>
            <InputGroup
              value={this.state.electronMirror}
              rightElement={this.selectMirrorMenu(false)}
              onChange={(e) => {
                this.setMirror(false, e.currentTarget.value);
              }}
            />
            <InputGroup
              value={this.state.electronNightlyMirror}
              rightElement={this.selectMirrorMenu(true)}
              onChange={(e) => {
                this.setMirror(true, e.currentTarget.value);
              }}
            />
          </FormGroup>
        </Callout>
      </div>
    );
  }
}
