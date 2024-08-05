import * as React from 'react';

import { Button, NonIdealState } from '@blueprintjs/core';

import { EditorMosaic } from '../editor-mosaic';

type RenderNonIdealStateProps = {
  editorMosaic: EditorMosaic;
};

export function RenderNonIdealState({
  editorMosaic,
}: RenderNonIdealStateProps) {
  const resolveButton = (
    <Button text="Reset editors" onClick={() => editorMosaic.resetLayout()} />
  );

  return (
    <NonIdealState
      action={resolveButton}
      icon="applications"
      description="You have closed all editors. You can open them again with the button below or in the sidebar menu!"
    />
  );
}
