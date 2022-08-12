import * as React from 'react';

import { ButtonGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { VersionSelect } from './version-select';

interface VersionChooserProps {
  appState: AppState;
}

/**
 * A dropdown allowing the selection of Electron versions. The actual
 * download is managed in the state.
 */
export const VersionChooser = observer((props: VersionChooserProps) => {
  const {
    Bisector,
    currentElectronVersion,
    isAutoBisecting,
    isRunning,
    isSettingsShowing,
    setVersion,
  } = props.appState;

  return (
    <ButtonGroup>
      <VersionSelect
        appState={props.appState}
        onVersionSelect={({ version }) => setVersion(version)}
        currentVersion={currentElectronVersion}
        disabled={
          !!Bisector || isAutoBisecting || isSettingsShowing || isRunning
        }
      />
    </ButtonGroup>
  );
});
