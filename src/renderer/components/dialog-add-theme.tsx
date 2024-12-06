import * as React from 'react';

import { Button, Dialog, FileInput } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as MonacoType from 'monaco-editor';

import { FiddleTheme } from '../../themes-defaults';
import { AppState } from '../state';
import { getTheme } from '../themes';

interface AddThemeDialogProps {
  appState: AppState;
}

interface AddThemeDialogState {
  file?: File;
}

/**
 * The "add monaco theme" dialog allows users to add custom editor themes.
 */
export const AddThemeDialog = observer(
  class AddThemeDialog extends React.Component<
    AddThemeDialogProps,
    AddThemeDialogState
  > {
    public resetState = { file: undefined };

    constructor(props: AddThemeDialogProps) {
      super(props);
      this.state = this.resetState;

      this.onSubmit = this.onSubmit.bind(this);
      this.onClose = this.onClose.bind(this);
      this.onChangeFile = this.onChangeFile.bind(this);
    }

    /**
     * Handles a change of the file input.
     */
    public async onChangeFile(event: React.FormEvent<HTMLInputElement>) {
      const { files } = event.target as HTMLInputElement;
      const file = files?.[0];

      this.setState({ file });
    }

    /**
     * Handles the submission of the dialog.
     */
    public async onSubmit(): Promise<void> {
      const { file } = this.state;
      const { appState } = this.props;

      const defaultTheme = await getTheme(appState, appState.theme);

      if (!file) return;

      try {
        const editor = JSON.parse(await file.text());
        if (!editor.base && !editor.rules)
          throw Error('File does not match specifications'); // has to have these attributes
        const newTheme: FiddleTheme = { ...defaultTheme };
        newTheme.editor =
          editor as Partial<MonacoType.editor.IStandaloneThemeData>;
        // Use file.name if no editor.name, and strip file extension (should be .json)
        const name: string = editor.name
          ? editor.name
          : file.name.slice(0, file.name.lastIndexOf('.'));
        await this.createNewThemeFromMonaco(name, newTheme);
      } catch (error) {
        appState.showErrorDialog(`${error}, please pick a different file.`);
        return;
      }

      this.onClose();
      return;
    }

    public async createNewThemeFromMonaco(
      name: string,
      newTheme: FiddleTheme,
    ): Promise<void> {
      if (!name) {
        throw new Error(`Filename ${name} not found`);
      }

      const theme = await window.ElectronFiddle.createThemeFile(newTheme, name);
      this.props.appState.setTheme(theme.file);
    }

    get buttons() {
      const canSubmit = !!this.state.file;

      return [
        <Button
          icon="add"
          key="submit"
          disabled={!canSubmit}
          onClick={this.onSubmit}
          text="Add"
        />,
        <Button
          icon="cross"
          key="cancel"
          onClick={this.onClose}
          text="Cancel"
        />,
      ];
    }

    public onClose() {
      this.setState(this.resetState, () => {
        this.props.appState.isThemeDialogShowing = false;
      });
    }

    public render() {
      const { isThemeDialogShowing } = this.props.appState;
      const inputProps = { accept: '.json' };
      const { file } = this.state;

      const text = file && file.path ? file.path : `Select the Monaco file...`;
      return (
        <Dialog
          isOpen={isThemeDialogShowing}
          onClose={this.onClose}
          title="Add theme"
          className="dialog-add-version"
        >
          <div className="bp3-dialog-body">
            <FileInput
              onInputChange={this.onChangeFile}
              inputProps={inputProps}
              text={text}
            />
            <br />
          </div>
          <div className="bp3-dialog-footer">
            <div className="bp3-dialog-footer-actions">{this.buttons}</div>
          </div>
        </Dialog>
      );
    }
  },
);
