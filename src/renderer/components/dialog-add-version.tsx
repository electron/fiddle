import * as React from 'react';

import {
  Button,
  Callout,
  Dialog,
  FileInput,
  InputGroup,
  Intent,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { Version } from '../../interfaces';
import { AppState } from '../state';
import { getElectronNameForPlatform } from '../utils/electron-name';
import { getLocalVersionForPath } from '../versions';

interface AddVersionDialogProps {
  appState: AppState;
}

interface AddVersionDialogState {
  isValidElectron: boolean;
  isValidName: boolean;
  existingLocalVersion?: Version;
  folderPath?: string;
  localName?: string;
  name: string;
}

/**
 * Generate a unique version key for a local build.
 * Uses a format that is valid semver but can never conflict
 * with a real Electron release.
 */
function generateLocalVersionKey(): string {
  return `0.0.0-local.${Date.now()}`;
}

/**
 * The "add version" dialog allows users to add custom builds of Electron.
 */
export const AddVersionDialog = observer(
  class AddVersionDialog extends React.Component<
    AddVersionDialogProps,
    AddVersionDialogState
  > {
    constructor(props: AddVersionDialogProps) {
      super(props);

      this.state = {
        isValidName: false,
        isValidElectron: false,
        name: '',
      };

      this.onSubmit = this.onSubmit.bind(this);
      this.onClose = this.onClose.bind(this);
      this.onChangeName = this.onChangeName.bind(this);
    }

    /**
     * Show dialog to select a local version and update state
     */
    public async selectLocalVersion(): Promise<void> {
      const selected = await window.ElectronFiddle.selectLocalVersion();
      if (selected) {
        const { folderPath, isValidElectron, localName } = selected;
        const existingLocalVersion = getLocalVersionForPath(folderPath);

        this.setState({
          existingLocalVersion,
          folderPath,
          isValidElectron,
          localName,
          // Pre-fill name from detected binary name if available
          name: localName || '',
          isValidName: !!localName,
        });
      }
    }

    /**
     * Handles a change of the name input
     */
    public onChangeName(event: React.ChangeEvent<HTMLInputElement>) {
      const name = event.target.value || '';
      const isValidName = name.trim().length > 0;

      this.setState({
        name,
        isValidName,
      });
    }

    /**
     * Handles the submission of the dialog
     */
    public async onSubmit(): Promise<void> {
      const { folderPath, name, isValidElectron, existingLocalVersion } =
        this.state;

      if (!folderPath) return;

      // swap to old local electron version if the user adds a new one with the same path
      if (isValidElectron && existingLocalVersion?.localPath) {
        // set previous version as active version
        this.props.appState.setVersion(existingLocalVersion.version);
      } else {
        const toAdd: Version = {
          localPath: folderPath,
          version: generateLocalVersionKey(),
          name: name.trim(),
        };
        this.props.appState.addLocalVersion(toAdd);
      }
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
      const { isValidElectron, isValidName, existingLocalVersion } = this.state;
      const canAdd = isValidElectron && isValidName && !existingLocalVersion;
      const canSwitch = isValidElectron && existingLocalVersion;

      return [
        <Button
          icon="add"
          key="submit"
          disabled={!canAdd && !canSwitch}
          onClick={this.onSubmit}
          text={canSwitch ? 'Switch' : 'Add'}
        />,
        <Button
          icon="cross"
          key="cancel"
          onClick={this.onClose}
          text="Cancel"
        />,
      ];
    }

    public render() {
      const { isAddVersionDialogShowing } = this.props.appState;
      const inputProps = {
        onClick: async (e: React.MouseEvent<HTMLInputElement, MouseEvent>) => {
          e.preventDefault();
          await this.selectLocalVersion();
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
              inputProps={inputProps}
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
      const { isValidElectron, folderPath, existingLocalVersion } = this.state;
      const canSwitch = isValidElectron && existingLocalVersion;

      if (!folderPath) return null;
      return (
        <Callout>
          {this.buildDialogText()}
          {!canSwitch && this.renderVersionInput()}
        </Callout>
      );
    }

    private buildDialogText(): string {
      const { isValidElectron, existingLocalVersion } = this.state;
      const canSwitch = isValidElectron && existingLocalVersion;

      if (canSwitch)
        return `This folder is already in use as version "${
          existingLocalVersion!.version
        }". Would you like to switch to that version now?`;

      if (isValidElectron)
        return `We found an ${getElectronNameForPlatform()} in this folder.`;

      return `We did not find a ${getElectronNameForPlatform()} in this folder...`;
    }

    private renderVersionInput(): JSX.Element | null {
      const { isValidElectron, isValidName, name } = this.state;
      if (!isValidElectron) return null;

      return (
        <>
          <p>
            Give this local build a name so you can identify it in the version
            list.
          </p>
          <InputGroup
            intent={isValidName ? undefined : Intent.DANGER}
            value={name}
            onChange={this.onChangeName}
            placeholder="e.g. My Debug Build"
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
        isValidName: false,
        name: '',
        folderPath: undefined,
        localName: undefined,
      });
    }
  },
);
