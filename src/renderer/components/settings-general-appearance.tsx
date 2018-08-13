import { shell } from 'electron';
import * as fsType from 'fs-extra';
import { observer } from 'mobx-react';
import * as path from 'path';
import * as React from 'react';

import { CONFIG_PATH } from '../../constants';
import { fancyImport } from '../../utils/import';
import { AppState } from '../state';
import { getAvailableThemes, THEMES_PATH } from '../themes';
import { LoadedFiddleTheme } from '../themes-defaults';

export interface AppearanceSettingsProps {
  appState: AppState;
}

export interface AppearanceSettingsState {
  themes: Array<LoadedFiddleTheme>;
}

/**
 * Settings content to manage GitHub-related preferences.
 *
 * @class GitHubSettings
 * @extends {React.Component<AppearanceSettingsProps, {}>}
 */
@observer
export class AppearanceSettings extends React.Component<
  AppearanceSettingsProps, AppearanceSettingsState
> {
  public constructor(props: AppearanceSettingsProps) {
    super(props);

    this.handleChange = this.handleChange.bind(this);
    this.openThemeFolder = this.openThemeFolder.bind(this);

    this.state = {
      themes: []
    };

    getAvailableThemes().then((themes) => {
      this.setState({ themes });
    });
  }

  /**
   * Handle change, which usually means that we'd like update
   * the current theme.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  public handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    this.props.appState.setTheme(event.target.value);
  }

  public async openThemeFolder(): Promise<boolean> {
    const fs = await fancyImport<typeof fsType>('fs-extra');

    try {
      await fs.ensureDir(THEMES_PATH);
      await shell.showItemInFolder(THEMES_PATH);
      return true;
    } catch (error) {
      console.warn(`Appearance Settings: Could not open themes folder`);
      return false;
    }
  }

  /**
   * Render the theme options.
   *
   * @returns {Array<JSX.Element>}
   */
  public renderOptions(): Array<JSX.Element> {
    const { themes } = this.state;

    return themes.map(({ name, file }) => {
      return (
        <option value={file} key={file}>
          {name}
        </option>
      );
    });
  }

  public render() {
    const themePath = path.join(CONFIG_PATH, 'themes');

    return (
      <div>
        <h4>Appearance</h4>
        <label key='theme-label'>
          To add themes, add JSON theme files to <a
            id='open-theme-folder'
            onClick={() => this.openThemeFolder()}
          >
            <code>{themePath}</code>
          </a>.
        </label>
        <select
          className='select-themes'
          value={`${this.props.appState.theme}`}
          onChange={this.handleChange}
        >
          {this.renderOptions()}
        </select>
      </div>
    );
  }
}
