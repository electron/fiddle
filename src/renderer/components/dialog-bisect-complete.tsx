import { Button, Dialog } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';

export interface BisectDialogProps {
  appState: AppState;
}

/**
 * The "add version" dialog allows users to add custom builds of Electron.
 *
 * @class BisectCompleteDialog
 * @extends {React.Component<BisectDialogProps, BisectDialogState>}
 */
@observer
export class BisectCompleteDialog extends React.Component<BisectDialogProps> {
  constructor(props: BisectDialogProps) {
    super(props);
    this.onClose = this.onClose.bind(this);
  }

  /**
   * Closes the dialog
   */
  public onClose() {
    this.props.appState.toggleBisectCompleteDialog();
  }

  public render() {
    const {
      isBisectCompleteDialogShowing,
      lastBisectResult
    } = this.props.appState;

    const [min, max] = lastBisectResult;

    return (
      <Dialog
        isOpen={isBisectCompleteDialogShowing}
        onClose={this.onClose}
        title='Bisect complete'
        className='dialog-add-version'
      >
        <div className='bp3-dialog-body'>
          Check between versions {min} and {max}
        </div>
        <div className='bp3-dialog-footer'>
          <div className='bp3-dialog-footer-actions'>
          <Button
            icon='cross'
            key='Close'
            onClick={this.onClose}
            text='Close'
          />
          </div>
        </div>
      </Dialog>
    );
  }
}
