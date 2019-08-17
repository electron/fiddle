import { Button, Callout, Dialog, FileInput, InputGroup, Intent } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';
import * as fsType from 'fs-extra';
import * as MonacoType from 'monaco-editor';
import * as path from 'path';
import { getAvailableThemes, getTheme, THEMES_PATH } from '../themes';
import { shell } from 'electron';

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
    const defaultTheme = await getTheme(this.props.appState.theme);

    if (!file) return;

    try {
      const editor = fsType.readJSONSync(file[0]);
      if (!editor.base && !editor.rules) return; // has to have these attributes
      defaultTheme.editor = editor as Partial<MonacoType.editor.IStandaloneThemeData>;
      const name = editor.name ? editor.name : path.parse(file[0]).name;
      this.createNewThemeFromMonaco(name);
    } catch {
      return;
    }

    this.onClose();
    return;
  }

  public async createNewThemeFromMonaco(name: string): Promise<boolean> {
    // const selectedFile = document.getElementById('input').files[0];

    // const selectedFile = document.getElementById('input').files[0];
    console.log('What did you get: ', e.target.value);
    // console.log('Type: ', e.currentTarget.);
    // fetch current theme
    const defaultTheme = await getTheme(this.props.appState.theme);
    try {
      if (!name) return false;
      const themePath = path.join(THEMES_PATH, `${name}.json`);

      await fsType.outputJSON(themePath, {
        ...defaultTheme,
        name,
        file: undefined,
        css: undefined
      }, {spaces: 2});

      // shell.showItemInFolder(themePath);
      // this.props.appState.setTheme(themePath);
      // this.setState({themes: await getAvailableThemes()});
      return true;
    } catch {
      return false;
    }
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
    // const inputProps = { webkitdirectory: 'true' };
    const inputProps = { accept: '.json' };
    const { file } = this.state;

    const text = file && file.path ? file.path : `Select the JSON Monaco file.`;
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
