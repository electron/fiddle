import {
  Button,
  Callout,
  Dialog,
  FileInput,
  InputGroup,
  Intent,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as path from 'path';
import * as React from 'react';
import * as semver from 'semver';

import { Version } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { getElectronNameForPlatform } from '../../utils/electron-name';
import { getIsDownloaded } from '../binary';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';
import { hasExistingLocalVersion } from '../versions';

interface AddVersionDialogProps {
  appState: AppState;
}

interface AddVersionDialogState {
  isValidElectron: boolean;
  isValidVersion: boolean;
  existingLocalVersion?: Version;
  folderPath?: string;
  version: string;
}

/**
 * The "add version" dialog allows users to add custom builds of Electron.
 *
 * @class AddVersionDialog
 * @extends {React.Component<AddVersionDialogProps, AddVersionDialogState>}
 */
@observer
export class AddVersionDialog extends React.Component<
  AddVersionDialogProps,
  AddVersionDialogState
> {
  constructor(props: AddVersionDialogProps) {
    super(props);

    this.state = {
      isValidVersion: false,
      isValidElectron: false,
      version: '',
    };

    this.onSubmit = this.onSubmit.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onChangeVersion = this.onChangeVersion.bind(this);

    ipcRendererManager.on(
      IpcEvents.LOAD_LOCAL_VERSION_FOLDER,
      (_event, [file]) => {
        this.setFolderPath(file);
      },
    );
  }

  public componentWillUnmount() {
    ipcRendererManager.removeAllListeners(IpcEvents.LOAD_LOCAL_VERSION_FOLDER);
  }

  /**
   * Handles a change of the file input
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public setFolderPath(folderPath: string) {
    const isValidElectron = getIsDownloaded('custom', folderPath);
    const existingLocalVersion = hasExistingLocalVersion(folderPath);

    this.setState({ existingLocalVersion, folderPath, isValidElectron });
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
    const {
      folderPath,
      version,
      isValidElectron,
      existingLocalVersion,
    } = this.state;
    const { versions } = this.props.appState;
    if (!folderPath) return;

    const name = folderPath.slice(-20).split(path.sep).slice(1).join(path.sep);

    const toAdd: Version = {
      localPath: folderPath,
      version,
      name,
    };

    // remove old local electron version if the user adds a new one with the same path
    const shouldRemovePreviousVersion = isValidElectron && existingLocalVersion;
    if (shouldRemovePreviousVersion) {
      // get previous version
      for (const ver of Object.values(versions)) {
        if (ver.localPath === existingLocalVersion?.localPath) {
          this.props.appState.removeVersion(ver);
        }
      }
    }
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
    const { isValidElectron, existingLocalVersion } = this.state;
    const canSubmit = this.state.isValidElectron && this.state.isValidVersion;
    // remove old local electron version if the user adds a new one with the same path
    const shouldRemovePreviousVersion = isValidElectron && existingLocalVersion;

    return [
      <Button
        icon="add"
        key="submit"
        disabled={shouldRemovePreviousVersion ? false : !canSubmit}
        onClick={this.onSubmit}
        text={shouldRemovePreviousVersion ? 'OK' : 'Add'}
      />,
      <Button icon="cross" key="cancel" onClick={this.onClose} text="Cancel" />,
    ];
  }

  public render() {
    const { isAddVersionDialogShowing } = this.props.appState;
    const inputProps = {
      onClick: (e: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
        e.preventDefault();
        ipcRendererManager.send(IpcEvents.SHOW_LOCAL_VERSION_FOLDER_DIALOG);
      },
    };
    const { folderPath } = this.state;

    const text =
      folderPath ||
      `Select the folder containing ${getElectronNameForPlatform()}...`;

    return (
      <Dialog
        isOpen={isAddVersionDialogShowing}
        onClose={this.onClose}
        title="Add local Electron build"
        className="dialog-add-version"
      >
        <div className="bp3-dialog-body">
          <FileInput
            id="custom-electron-version"
            inputProps={inputProps as any}
            text={text}
          />
          <br />
          {this.renderPath()}
        </div>
        <div className="bp3-dialog-footer">
          <div className="bp3-dialog-footer-actions">{this.buttons}</div>
        </div>
      </Dialog>
    );
  }

  private renderPath(): JSX.Element | null {
    const { folderPath } = this.state;

    if (!folderPath) return null;
    return (
      <Callout>
        {this.renderDialog()}
        {this.renderVersionInput()}
      </Callout>
    );
  }

  private renderDialog(): string {
    const { existingLocalVersion, isValidElectron } = this.state;

    if (isValidElectron && existingLocalVersion) {
      return `This folder path has already been added as version "${existingLocalVersion.version}". Would you like to set this path as a new version? \n \n`;
    } else if (isValidElectron) {
      return `We found an ${getElectronNameForPlatform()} in this folder.`;
    }

    return `We did not find a ${getElectronNameForPlatform()} in this folder...`;
  }

  private renderVersionInput(): JSX.Element | null {
    const {
      existingLocalVersion,
      isValidElectron,
      isValidVersion,
      version,
    } = this.state;
    const shouldRemovePreviousVersion = isValidElectron && existingLocalVersion;

    if (!isValidElectron) return null;

    return (
      <>
        <p>
          {shouldRemovePreviousVersion && <br />}
          Please specify a version, used for typings and the name. Must be{' '}
          <code>semver</code> compliant.
        </p>
        <InputGroup
          intent={isValidVersion ? undefined : Intent.DANGER}
          value={version}
          onChange={this.onChangeVersion}
          placeholder="4.0.0"
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
      folderPath: undefined,
    });
  }
}
