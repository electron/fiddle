import { ButtonGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { VersionSelect } from './version-select';

export interface VersionChooserProps {
  appState: AppState;
}

/**
 * A dropdown allowing the selection of Electron versions. The actual
 * download is managed in the state.
 */
export const VersionChooser = observer((props: VersionChooserProps) => {
  const { currentElectronVersion, Bisector, setVersion } = props.appState;

  return (
    <ButtonGroup>
      <VersionSelect
        appState={props.appState}
        onVersionSelect={({ version }) => setVersion(version)}
        currentVersion={currentElectronVersion}
        disabled={!!Bisector}
      />
    </ButtonGroup>
  );
});
