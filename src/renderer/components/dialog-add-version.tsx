
import { Button, Callout, Dialog, FileInput, InputGroup, Intent } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as path from 'path';
import * as React from 'react';
import * as semver from 'semver';

import { NpmVersion } from '../../interfaces';
import { getElectronNameForPlatform } from '../../utils/electron-name';
import { AppState } from '../state';

export interface AddVersionDialogProps {
  appState: AppState;
}

export interface AddVersionDialogState {
  isValidElectron: boolean;
  isValidVersion: boolean;
  file?: File;
  version: string;
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
      isValidVersion: false,
      isValidElectron: false,
      version: ''
    };

    this.onSubmit = this.onSubmit.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onChangeFile = this.onChangeFile.bind(this);
    this.onChangeVersion = this.onChangeVersion.bind(this);
  }

  /**
   * Handles a change of the file input
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public async onChangeFile(event: React.FormEvent<HTMLInputElement>) {
    const { files } = event.target as any;
    const { binaryManager } = this.props.appState;
    const file = files && files[0] ? files[0] : undefined;

    const isValidElectron = !!(file
      && file.path
      && await binaryManager.getIsDownloaded('custom', file.path));

    this.setState({ file, isValidElectron });
  }

  public onChangeVersion(event: React.ChangeEvent<HTMLInputElement>) {
    const version = event.target.value || '';
    const isValidVersion = !!semver.valid(version);

    this.setState({
      version,
      isValidVersion,
     });
  }

  /**
   * Handles the submission of the dialog
   *
   * @returns {Promise<void>}
   */
  public async onSubmit(): Promise<void> {
    const { file, version } = this.state;

    if (!file) return;

    const name = file.path
      .slice(-20)
      .split(path.sep)
      .slice(1)
      .join(path.sep);

    const toAdd: NpmVersion = {
      localPath: file.path,
      version,
      name
    };

    this.props.appState.addLocalVersion(toAdd);
    this.onClose();
  }

  /**
   * Closes the dialog
   */
  public onClose() {
    this.props.appState.isAddVersionDialogShowing = false;
    this.reset();
  }

  get buttons() {
    const canSubmit = this.state.isValidElectron && this.state.isValidVersion;

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

  public render() {
    const { isAddVersionDialogShowing } = this.props.appState;
    const inputProps = { webkitdirectory: 'true' };
    const { file } = this.state;

    const text = file && file.path
      ? file.path
      : `Select the folder containing ${getElectronNameForPlatform()}...`;

    return (
      <Dialog
        isOpen={isAddVersionDialogShowing}
        onClose={this.onClose}
        title='Add local Electron build'
        className='dialog-add-version'
      >
        <div className='bp3-dialog-body'>
          <FileInput
            onInputChange={this.onChangeFile}
            id='custom-electron-version'
            inputProps={inputProps as any}
            text={text}
          />
          <br />
          {this.renderPath()}
        </div>
        <div className='bp3-dialog-footer'>
          <div className='bp3-dialog-footer-actions'>
            {this.buttons}
          </div>
        </div>
      </Dialog>
    );
  }

  private renderPath(): JSX.Element | null {
    const { file, isValidElectron } = this.state;

    if (!file || !file.path) return null;

    const info = isValidElectron
      ? `We found an ${getElectronNameForPlatform()} in this folder.`
      : `We did not find a ${getElectronNameForPlatform()} in this folder...`;

    return (
      <Callout>
        {info}
        {this.renderVersionInput()}
      </Callout>
    );
  }

  private renderVersionInput(): JSX.Element | null {
    const { isValidElectron, isValidVersion, version } = this.state;

    if (!isValidElectron) return null;

    return (
      <>
        <p>
          Please specify a version, used for typings and the name.
          Must be <code>semver</code> compliant.
        </p>
        <InputGroup
          intent={isValidVersion ? undefined : Intent.DANGER}
          value={version}
          onChange={this.onChangeVersion}
          placeholder='4.0.0'
        />
      </>
    );
  }

  /**
   * Reset this component's state
   */
  private reset(): void {
    this.setState({
      isValidElectron: false,
      isValidVersion: false,
      version: '',
      file: undefined
    });
  }
}
