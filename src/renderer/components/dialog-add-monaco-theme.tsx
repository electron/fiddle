import { Button, Callout, Dialog, FileInput, InputGroup, Intent } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';

export interface AddThemeDialogProps {
  appState: AppState;
}

export interface AddThemeDialogState {
  name: string;
  file?: File;
}

/**
 * The "add monaco theme" dialog allows users to add custom editor themes.
 *
 * @class AddThemeDialog
 * @extends {React.Component<AddThemeDialogProps, AddThemeDialogState>}
 */
@observer
export class AddThemeDialog extends React.Component<AddThemeDialogProps, AddThemeDialogState> {
  constructor(props: AddThemeDialogProps) {
    super(props);

    this.state = {
      name: 'test'
    };
    console.log('IS IT Constructing?!');

    this.onSubmit = this.onSubmit.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onChangeFile = this.onChangeFile.bind(this);
    this.reset = this.reset.bind(this);
  }

  /**
   * Handles a change of the file input
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public async onChangeFile(event: React.FormEvent<HTMLInputElement>) {
    const { files } = event.target as any;
    const file = files && files[0] ? files[0] : undefined;

    this.setState({ file });
  }

  /**
   * Handles the submission of the dialog
   *
   * @returns {Promise<void>}
   */
  public async onSubmit(): Promise<void> {
    const { file } = this.state;

    if (!file) return;

    console.log('GOT A FILE!!! ', file.path);

    this.onClose();
    return;
  }

  get buttons() {
    const canSubmit = !!this.state.file;

    return [
      (
        <Button
          icon='add'
          key='submit'
          disabled={!canSubmit}
          onClick={this.onSubmit}
          text='Add'
        />
      ), (
        <Button
          icon='cross'
          key='cancel'
          onClick={this.onClose}
          text='Cancel'
        />
      )
    ];
  }

  public onClose() {
    this.props.appState.isMonacoVersionDialogShowing = false;
    this.reset();
  }

  public render() {
    const { isMonacoVersionDialogShowing } = this.props.appState;
    const inputProps = { webkitdirectory: 'true' };
    const { file } = this.state;

    const text =  'test test';
    console.log('IS IT SHOWING AM I HERE OR WHAT?!', isMonacoVersionDialogShowing)
    return (
      <Dialog
        isOpen={isMonacoVersionDialogShowing}
        onClose={this.onClose}
        title='Add local Electron build'
        className='dialog-add-version'
      >
        <div className='bp3-dialog-body'>
          <FileInput
            onInputChange={this.onChangeFile}
            // id='custom-electron-version'
            inputProps={inputProps as any}
            text={text}
          />
          <br />
        </div>
        <div className='bp3-dialog-footer'>
          <div className='bp3-dialog-footer-actions'>
            {this.buttons}
          </div>
        </div>
      </Dialog>
    );
  }

  /**
   * Reset this component's state
   */
  private reset(): void {
    this.setState({
      
    });
  }

}
