import { faKey, faSpinner } from '@fortawesome/fontawesome-free-solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { Dialog } from './dialog';

export interface AddVersionDialogProps {
  appState: AppState;
}

export interface AddVersionDialogState {
  validInput: boolean;
}

/**
 * The "add version" dialog allows users to add custom builds of Electron.
 *
 * @class AddVersionDialog
 * @extends {React.Component<AddVersionDialogProps, AddVersionDialogState>}
 */
@observer
export class AddVersionDialog extends React.Component<AddVersionDialogProps, AddVersionDialogState> {
  constructor(props: AddVersionDialogProps) {
    super(props);

    this.state = {
      validInput: false
    };

    this.obSubmit = this.obSubmit.bind(this);
    this.onClose = this.onClose.bind(this);
  }

  /**
   * Handles the submission of the dialog
   *
   * @returns {Promise<void>}
   */
  public async obSubmit(): Promise<void> {
    console.log('hi');
  }

  /**
   * Closes the dialog
   */
  public onClose() {
    this.props.appState.isAddVersionDialogShowing = false;
    this.reset();
  }

  /**
   * Reset this component's state
   */
  public reset(): void {
    this.setState({
    });
  }

  get buttons() {
    const canSubmit = this.state.validInput;

    return [
      (
        <button
          className='button'
          disabled={!canSubmit}
          onClick={this.obSubmit}
        >
          Done
        </button>
      ), (
        <button className='cancel' onClick={this.onClose}>Cancel</button>
      )
    ];
  }

  public render() {
    const { isAddVersionDialogShowing } = this.props.appState;

    return (
      <Dialog
        isShowing={isAddVersionDialogShowing}
        isShowingBackdrop={true}
        buttons={this.buttons}
        onClose={this.onClose}
        isCentered={true}
        className='AddVersionDialog'
        key='AddVersionDialog'
      >
        <span className='generateTokenText'>
          <FontAwesomeIcon icon={faKey} />
          Generate and paste it here:
        </span>
      </Dialog>
    );
  }
}
