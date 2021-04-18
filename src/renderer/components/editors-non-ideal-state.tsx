import * as React from 'react';

import { Button, NonIdealState } from '@blueprintjs/core';
import { Fiddle } from '../fiddle';

export function renderNonIdealState(fiddle: Fiddle) {
  const resolveButton = (
    <Button text="Open all editors" onClick={() => fiddle.showAll()} />
  );

  return (
    <NonIdealState
      action={resolveButton}
      icon="applications"
      description='You have closed all editors. You can open them again with the button below or the "Editors" button above!'
    />
  );
}
