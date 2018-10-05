import { observer } from 'mobx-react';
import * as path from 'path';
import * as React from 'react';

import { GitHubVersion } from '../../interfaces';
import { getElectroNameForPlatform } from '../../utils/electron-name';
import { AppState } from '../state';
import { Dialog } from './dialog';

export interface AddVersionDialogProps {
  appState: AppState;
}

export interface AddVersionDialogState {
  isValidInput: boolean;
  file?: File;
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
      isValidInput: false
    };

    this.onSubmit = this.onSubmit.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  /**
   * Handles a change of the file input
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public async onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { files } = event.target;
    const { binaryManager } = this.props.appState;
    const file = files && files[0] ? files[0] : undefined;

    const isValidInput = !!(file
      && file.path
      && await binaryManager.getIsDownloaded('custom', file.path));

    this.setState({ file, isValidInput });
  }

  /**
   * Handles the submission of the dialog
   *
   * @returns {Promise<void>}
   */
  public async onSubmit(): Promise<void> {
    const { file } = this.state;

    if (!file) return;

    const name = file.path
      .slice(-20)
      .split(path.sep)
      .slice(1)
      .join(path.sep);

    const toAdd: GitHubVersion = {
      url: file.path,
      assets_url: file.path,
      body: `Local version, added at ${Date.now()}`,
      created_at: Date.now().toString(),
      name,
      html_url: '',
      prerelease: true,
      published_at: Date.now().toString(),
      tag_name: name,
      target_commitish: ''
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

  /**
   * Reset this component's state
   */
  public reset(): void {
    this.setState({
      isValidInput: false,
      file: undefined
    });
  }

  get buttons() {
    const canSubmit = this.state.isValidInput;

    return [
      (
        <button
          className='button'
          key='submit'
          disabled={!canSubmit}
          onClick={this.onSubmit}
        >
          Add
        </button>
      ), (
        <button
          className='cancel'
          key='cancel'
          onClick={this.onClose}
        >
          Cancel
        </button>
      )
    ];
  }

  public render() {
    const { isAddVersionDialogShowing } = this.props.appState;
    const dirOptions = { webkitdirectory: 'true' };

    return (
      <Dialog
        isShowing={isAddVersionDialogShowing}
        isShowingBackdrop={true}
        buttons={this.buttons}
        onClose={this.onClose}
        isCentered={true}
        className='add-version-dialog'
        key='add-version-dialog'
      >
        <label
          htmlFor='custom-electron-version'
          className='force-button'
        >
          Select the folder containing {getElectroNameForPlatform()}
        </label>
        <input
          type='file'
          onChange={this.onChange}
          id='custom-electron-version'
          name='custom-electron-version'
          {...dirOptions}
        />
        {this.renderPath()}
      </Dialog>
    );
  }

  private renderPath(): JSX.Element | null {
    const { file, isValidInput } = this.state;

    if (!file || !file.path) return null;

    const info = isValidInput
      ? `We found an ${getElectroNameForPlatform()} in this folder.`
      : `We did not find a ${getElectroNameForPlatform()} in this folder...`;

    return (
      <>
        <input
          readOnly={true}
          value={file.path}
        />
        <span>
          {info}
        </span>
      </>
    );
  }
}
