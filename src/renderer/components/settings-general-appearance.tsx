import { Button, Callout, FormGroup, MenuItem } from '@blueprintjs/core';
import { ItemPredicate, ItemRenderer, Select } from '@blueprintjs/select';
import { remote, shell } from 'electron';
import * as fsType from 'fs-extra';
import { observer } from 'mobx-react';
import * as path from 'path';
import * as React from 'react';

import * as MonacoType from 'monaco-editor';
import { highlightText } from '../../utils/highlight-text';
import { fancyImport } from '../../utils/import';
import { AppState } from '../state';
import { getAvailableThemes, getTheme, THEMES_PATH } from '../themes';
import { LoadedFiddleTheme } from '../themes-defaults';

const ThemeSelect = Select.ofType<LoadedFiddleTheme>();

/**
 * Helper method: Returns the <Select /> predicate for an Electron
 * version.
 *
 * @param {string} query
 * @param {ElectronVersion} { version }
 * @returns
 */
export const filterItem: ItemPredicate<LoadedFiddleTheme> = (query, { name }) => {
  return name.toLowerCase().includes(query.toLowerCase());
};


/**
 * Helper method: Returns the <Select /> <MenuItem /> for Electron
 * versions.
 *
 * @param {ElectronVersion} item
 * @param {IItemRendererProps} { handleClick, modifiers, query }
 * @returns
 */
export const renderItem: ItemRenderer<LoadedFiddleTheme> = (item, { handleClick, modifiers, query }) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }

  return (
    <MenuItem
      active={modifiers.active}
      disabled={modifiers.disabled}
      text={highlightText(item.name, query)}
      key={item.name}
      onClick={handleClick}
      icon='media'
    />
  );
};

export interface AppearanceSettingsProps {
  appState: AppState;
}

export interface AppearanceSettingsState {
  themes: Array<LoadedFiddleTheme>;
  selectedTheme?: LoadedFiddleTheme;
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
      const { theme } = this.props.appState;
      const selectedTheme = theme &&
        themes.find(({ file }) => file === theme) || themes[0];

      this.setState({ themes, selectedTheme });
    });

    this.createNewThemeFromCurrent = this.createNewThemeFromCurrent.bind(this);
    this.createNewThemeFromMonaco = this.createNewThemeFromMonaco.bind(this);
    this.openThemeFolder = this.openThemeFolder.bind(this);
  }

  /**
   * Handle change, which usually means that we'd like update
   * the current theme.
   *
   * @param {LoadedFiddleTheme} theme
   */
  public handleChange(theme: LoadedFiddleTheme) {
    this.setState({ selectedTheme: theme });
    this.props.appState.setTheme(theme.file);
  }

  /**
   * Creates a new theme from the current template.
   *
   * @returns {Promise<boolean>}
   * @memberof AppearanceSettings
   */
  public async createNewThemeFromCurrent(): Promise<boolean> {
    const { appState } = this.props;
    const fs = await fancyImport<typeof fsType>('fs-extra');
    const theme = await getTheme(appState.theme);

    try {
      const namor = await fancyImport<any>('namor');
      const name = namor.generate({ words: 2, numbers: 0 });
      const themePath = path.join(THEMES_PATH, `${name}.json`);

      await fs.outputJSON(themePath, {
        ...theme,
        name,
        file: undefined,
        css: undefined
      }, { spaces: 2 });

      shell.showItemInFolder(themePath);

      this.setState({themes: await getAvailableThemes()});

      return true;
    } catch (error) {
      console.warn(`Themes: Failed to create new theme from current`, error);

      return false;
    }
  }

  /**
   * Creates a new template that takes in Monaco editor JSON theme only.
   */
  public async createNewThemeFromMonaco(): Promise<boolean> {
    // fetch current theme
    const defaultTheme = await getTheme(this.props.appState.theme);
    const fs = await fancyImport<typeof fsType>('fs-extra');
    try {
      const name = await this.promptForTheme(defaultTheme);
      if (name instanceof Error) {
        return false;
      }
      const themePath = path.join(THEMES_PATH, `${name}.json`);
      await fs.outputJSON(themePath, {
        ...defaultTheme,
        name,
        file: undefined,
        css: undefined
      }, {spaces: 2});
      shell.showItemInFolder(themePath);
      this.setState({themes: await getAvailableThemes()});
      return true;
    } catch (error) {
      return false;
    }

    return false;
  }

  /**
   * Creates the themes folder in .electron-fiddle if one does not
   * exist yet, then shows that folder in the Finder/Explorer.
   *
   * @returns {Promise<boolean>}
   */
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

  public render() {
    const { selectedTheme } = this.state;
    const selectedName = selectedTheme && selectedTheme.name || 'Select a theme';

    return (
      <div className='settings-appearance'>
        <h4>Appearance</h4>
        <FormGroup
          label='Choose your theme'
          inline={true}
        >
          <ThemeSelect
            filterable={true}
            items={this.state.themes}
            itemRenderer={renderItem}
            itemPredicate={filterItem}
            onItemSelect={this.handleChange}
            noResults={<MenuItem disabled={true} text='No results.' />}
          >
            <Button
              text={selectedName}
              icon='tint'
            />
          </ThemeSelect>
        </FormGroup>
        <Callout>
          <p>
            To add themes, add JSON theme files to <a
              id='open-theme-folder'
              onClick={this.openThemeFolder}
            >
              <code>{THEMES_PATH}</code>
            </a>. The easiest way to get started is to clone one of the two existing
            themes and to add your own colors.
          </p>
          <p>
            Additionally, if you wish to import a Monaco Editor theme, just pick your JSON file and Fiddle will do the rest.
          </p>
          <Button
            onClick={this.createNewThemeFromCurrent}
            text='Create theme from current selection'
            icon='duplicate'
          />
          <Button
            onClick={this.createNewThemeFromMonaco}
            text='Add a Monaco Editor theme'
            icon='duplicate'
          />
        </Callout>
      </div>
    );
  }

  private async promptForTheme(defaultTheme: LoadedFiddleTheme) {
    const filePicked = await remote.dialog.showOpenDialog({
      title: 'Pick a VSCode editor theme file',
      properties: ['openFile'],
      filters: [ { name: 'JSON', extensions: ['json']}]
    });
    if (filePicked === undefined || filePicked.length === 0) {
      return Error('Prompt cancelled by user');
    }
    const editor = fsType.readJSONSync(filePicked[0]);
    defaultTheme.editor = editor as Partial<MonacoType.editor.IStandaloneThemeData>;
    if (editor.name) {
      // if this exists, set that as the name
      return editor.name;
    }
    const name = path.parse(filePicked[0]).name;
    return name;
  }

}
