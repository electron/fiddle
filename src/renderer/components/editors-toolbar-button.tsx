import * as React from 'react';

import { Button } from '@blueprintjs/core';
import { MosaicWindowContext } from 'react-mosaic-component';

import { EditorId } from '../../interfaces';
import { AppState } from '../state';

export interface ToolbarButtonProps {
  appState: AppState;
  id: EditorId;
}

export class MaximizeButton extends React.PureComponent<ToolbarButtonProps> {
  public static contextTypes = MosaicWindowContext;
  public context: MosaicWindowContext<EditorId>;

  constructor(props: ToolbarButtonProps) {
    super(props);

    this.expand = this.expand.bind(this);
  }

  public render() {
    return (
      <Button
        icon='maximize'
        className='bp3-small'
        onClick={this.expand}
      />
    );
  }

  private expand() {
    const path = this.context.mosaicWindowActions.getPath();
    return this.context.mosaicActions.expand(path);
  }
}

export class RemoveButton extends React.PureComponent<ToolbarButtonProps> {
  public static contextTypes = MosaicWindowContext;
  public context: MosaicWindowContext<EditorId>;

  constructor(props: ToolbarButtonProps) {
    super(props);
    this.remove = this.remove.bind(this);
  }

  public render() {
    return (
      <Button
        icon='cross'
        className='bp3-small'
        onClick={this.remove}
      />
    );
  }

  private remove() {
    this.props.appState.hideAndBackupEditor(this.props.id);
  }
}
