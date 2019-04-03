import * as React from 'react';

import { Button } from '@blueprintjs/core';
import { MosaicWindowContext } from 'react-mosaic-component';

import { MosaicId } from '../../interfaces';
import { isEditorId } from '../../utils/type-checks';
import { AppState } from '../state';

export interface ToolbarButtonProps {
  appState: AppState;
  id: MosaicId;
}

export class MaximizeButton extends React.PureComponent<ToolbarButtonProps> {
  public static contextTypes = MosaicWindowContext;
  public context: MosaicWindowContext<MosaicId>;

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

  /**
   * Expand this panel
   */
  public expand() {
    const path = this.context.mosaicWindowActions.getPath();
    return this.context.mosaicActions.expand(path);
  }
}

export class RemoveButton extends React.PureComponent<ToolbarButtonProps> {
  public static contextTypes = MosaicWindowContext;
  public context: MosaicWindowContext<MosaicId>;

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

  /**
   * Remove this panel
   */
  public remove() {
    this.props.appState.hideAndBackupMosaic(this.props.id);
  }
}
