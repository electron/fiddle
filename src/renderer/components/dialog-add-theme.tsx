import * as React from 'react';

import * as path from 'path';

import { Button, Dialog, FileInput } from '@blueprintjs/core';
import { shell } from 'electron';
import * as fs from 'fs-extra';
import { observer } from 'mobx-react';
import * as MonacoType from 'monaco-editor';

import { AppState } from '../state';
import { THEMES_PATH, getTheme } from '../themes';
import { LoadedFiddleTheme, defaultDark } from '../themes-defaults';

interface AddThemeDialogProps {
  appState: AppState;
}

interface AddThemeDialogState {
  file?: File;
}

/**
 * The "add monaco theme" dialog allows users to add custom editor themes.
 *
 * @class AddThemeDialog
 * @extends {React.Component<AddThemeDialogProps, AddThemeDialogState>}
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
      this.reset = this.reset.bind(this);
    }

    /**
     * Handles a change of the file input.
     *
     * @param {React.ChangeEvent<HTMLInputElement>} event
     */
    public async onChangeFile(event: React.FormEvent<HTMLInputElement>) {
      const { files } = event.target as any;
      const file = files?.[0];

      this.setState({ file });
    }

    /**
     * Handles the submission of the dialog.
     *
     * @returns {Promise<void>}
     */
    public async onSubmit(): Promise<void> {
      const { file } = this.state;
      const { appState } = this.props;

      const defaultTheme = !!appState.theme
        ? await getTheme(appState.theme)
        : defaultDark;

      if (!file) return;

      try {
        const editor = fs.readJSONSync(file.path);
        if (!editor.base && !editor.rules)
          throw Error('File does not match specifications'); // has to have these attributes
        defaultTheme.editor = editor as Partial<MonacoType.editor.IStandaloneThemeData>;
        const newTheme = defaultTheme;
        const name = editor.name ? editor.name : file.name;
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
      newTheme: LoadedFiddleTheme,
    ): Promise<void> {
      if (!name) {
        throw new Error(`Filename ${name} not found`);
      }

      const themePath = path.join(THEMES_PATH, `${name}`);

      await fs.outputJSON(
        themePath,
        {
          ...newTheme,
          name,
        },
        { spaces: 2 },
      );

      this.props.appState.setTheme(themePath);
      shell.showItemInFolder(themePath);
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
      this.props.appState.isThemeDialogShowing = false;
      this.reset();
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
              inputProps={inputProps as any}
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

    /**
     * Reset this component's state
     */
    private reset(): void {
      this.setState(this.resetState);
      return;
    }
  },
);
