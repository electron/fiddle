import * as React from 'react';

import { Button, NonIdealState } from '@blueprintjs/core';

import { EditorId } from '../../interfaces';
import { AppState } from '../state';

export function renderNonIdealState(appState: AppState) {
  const allEditors = [ EditorId.html, EditorId.main, EditorId.renderer ];
  const resolveButton = (
    <Button
      text='Open all editors'
      onClick={() => appState.setVisibleMosaics(allEditors)}
    />
  );

  return (
    <NonIdealState
      action={resolveButton}
      icon='applications'
      description='You have closed all editors. You can open them again with the button below or the "Editors" button above!'
    />
  );
}
