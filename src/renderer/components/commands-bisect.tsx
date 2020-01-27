import { Button } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { GenericDialogType } from '../../../src/interfaces';
import { AppState } from '../state';

interface BisectHandlerProps {
  appState: AppState;
}

@observer
export class BisectHandler extends React.Component<BisectHandlerProps> {
  constructor(props: BisectHandlerProps) {
    super(props);

    this.continueBisect = this.continueBisect.bind(this);
    this.terminateBisect = this.terminateBisect.bind(this);
  }

  public continueBisect(isGood: boolean) {
    const { appState } = this.props;
    const response = appState.Bisector!.continue(isGood);
    if (Array.isArray(response)) {
      this.terminateBisect();
      const [minRev, maxRev] = response;
      const [minVer, maxVer] = [minRev.version, maxRev.version];
      const message = `Check between versions ${minVer} and ${maxVer}.`;
      appState.pushOutput(`[BISECT] Complete: ${message}`);
      appState.setGenericDialogOptions({
        type: GenericDialogType.message,
        label: `Bisect complete. ${message}`,
        cancel: undefined
      });
      appState.isGenericDialogShowing = true;
    } else {
      appState.setVersion(response.version);
    }
  }

  public terminateBisect() {
    const { appState } = this.props;
    appState.Bisector = undefined;
  }

  public render() {
    const { appState } = this.props;
    if (!!appState.Bisector) {
      return (
        <>
          <Button
            icon={'thumbs-up'}
            onClick={() => this.continueBisect(true)}
          />
          <Button
            icon={'thumbs-down'}
            onClick={() => this.continueBisect(false)}
          />
          <Button
            icon={'cross'}
            onClick={this.terminateBisect}
          >
            Cancel Bisect
          </Button>
        </>
      );
    } else {
      return (
        <Button
          icon='git-branch'
          text='Bisect'
          onClick={appState.toggleBisectDialog}
        />
      );
    }
  }
}
