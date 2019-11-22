import { Button } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

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
      appState.pushOutput(`[BISECT] Complete: Check between versions ${minRev.version} and ${maxRev.version}.`);
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
