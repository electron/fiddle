import * as React from 'react';

import { Button } from '@blueprintjs/core';
import { InstallState } from '@vertedinde/fiddle-core';
import { observer } from 'mobx-react';

import { AppState } from '../state';

interface BisectHandlerProps {
  appState: AppState;
}

export const BisectHandler = observer(
  class BisectHandler extends React.Component<BisectHandlerProps> {
    constructor(props: BisectHandlerProps) {
      super(props);

      this.continueBisect = this.continueBisect.bind(this);
      this.terminateBisect = this.terminateBisect.bind(this);
    }

    private continueBisect(isGood: boolean) {
      window.ElectronFiddle.app.runner.stop();

      const { appState } = this.props;
      const response = appState.Bisector!.continue(isGood);

      if (Array.isArray(response)) {
        this.terminateBisect();

        const [minRev, maxRev] = response;
        const [minVer, maxVer] = [minRev.version, maxRev.version];
        const label = (
          <>
            Bisect complete. Check the range{' '}
            <a
              target="_blank"
              rel="noreferrer"
              href={`https://github.com/electron/electron/compare/v${minVer}...v${maxVer}`}
            >
              {minVer}...{maxVer}
            </a>
            .
          </>
        );

        appState.pushOutput(`[BISECT] Complete: ${minVer}...${maxVer}`);
        appState.showInfoDialog(label);
      } else {
        appState.setVersion(response.version);
      }
    }

    private terminateBisect() {
      const { appState } = this.props;
      appState.Bisector = undefined;
    }

    public render() {
      const { appState } = this.props;
      if (!!appState.Bisector) {
        const isDownloading =
          appState.currentElectronVersion.state === InstallState.downloading;
        return (
          <>
            <Button
              icon={'thumbs-up'}
              aria-label={'Mark commit as good'}
              onClick={() => this.continueBisect(true)}
              disabled={isDownloading}
            />
            <Button
              icon={'thumbs-down'}
              aria-label={'Mark commit as bad'}
              onClick={() => this.continueBisect(false)}
              disabled={isDownloading}
            />
            <Button
              aria-label={'Cancel bisect'}
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
            icon="git-branch"
            text="Bisect"
            disabled={appState.isAutoBisecting}
            onClick={appState.toggleBisectDialog}
          />
        );
      }
    }
  },
);
