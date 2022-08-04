import * as React from 'react';

import * as path from 'path';

import {
  Button,
  Callout,
  Checkbox,
  FormGroup,
  MenuItem,
} from '@blueprintjs/core';
import { ItemPredicate, ItemRenderer, Select } from '@blueprintjs/select';
import { shell } from 'electron';
import * as fs from 'fs-extra';
import { reaction } from 'mobx';
import { observer } from 'mobx-react';
import * as namor from 'namor';

import { highlightText } from '../../utils/highlight-text';
import { AppState } from '../state';
import { THEMES_PATH, getAvailableThemes, getTheme } from '../themes';
import { LoadedFiddleTheme } from '../themes-defaults';

const ThemeSelect = Select.ofType<LoadedFiddleTheme>();

/**
 * Helper method: Returns the <Select /> predicate for an Electron
 * version.
 *
 * @param {string} query
 * @param {RunnableVersion} { name }
 * @returns
 */
export const filterItem: ItemPredicate<LoadedFiddleTheme> = (
  query,
  { name },
) => {
  return name.toLowerCase().includes(query.toLowerCase());
};

/**
 * Helper method: Returns the <Select /> <MenuItem /> for Electron
 * versions.
 *
 * @param {RunnableVersion} item
 * @param {IItemRendererProps} { handleClick, modifiers, query }
 * @returns
 */
export const renderItem: ItemRenderer<LoadedFiddleTheme> = (
  item,
  { handleClick, modifiers, query },
) => {
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
      icon="media"
    />
  );
};

interface AppearanceSettingsProps {
  appState: AppState;
  toggleHasPopoverOpen: () => void;
}

interface AppearanceSettingsState {
  themes: Array<LoadedFiddleTheme>;
  selectedTheme?: LoadedFiddleTheme;
}

/**
 * Settings content to manage GitHub-related preferences.
 *
 * @class GitHubSettings
 * @extends {React.Component<AppearanceSettingsProps, AppearanceSettingsState>}
 */
export const AppearanceSettings = observer(
  class AppearanceSettings extends React.Component<
    AppearanceSettingsProps,
    AppearanceSettingsState
  > {
    public constructor(props: AppearanceSettingsProps) {
      super(props);

      this.handleChange = this.handleChange.bind(this);
      this.openThemeFolder = this.openThemeFolder.bind(this);
      this.handleAddTheme = this.handleAddTheme.bind(this);
      this.handleThemeSource = this.handleThemeSource.bind(this);

      this.state = {
        themes: [],
      };

      getAvailableThemes().then((themes) => {
        const { theme } = this.props.appState;
        const selectedTheme =
          (theme && themes.find(({ file }) => file === theme)) || themes[0];

        this.setState({ themes, selectedTheme });

        // set up mobx so that changes from system sync are reflected in picker
        reaction(
          () => this.props.appState.theme,
          async () => {
            const selectedTheme = await getTheme(this.props.appState.theme);
            this.setState({ selectedTheme });
          },
        );
      });

      this.createNewThemeFromCurrent = this.createNewThemeFromCurrent.bind(
        this,
      );
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
      const theme = await getTheme(appState.theme);

      try {
        const name = namor.generate({ words: 2, numbers: 0 });
        const themePath = path.join(THEMES_PATH, `${name}.json`);

        await fs.outputJSON(
          themePath,
          {
            ...theme,
            name,
            file: undefined,
            css: undefined,
          },
          { spaces: 2 },
        );

        shell.showItemInFolder(themePath);

        this.setState({ themes: await getAvailableThemes() });

        return true;
      } catch (error) {
        console.warn(`Themes: Failed to create new theme from current`, error);

        return false;
      }
    }

    /**
     * Creates the themes folder in .electron-fiddle if one does not
     * exist yet, then shows that folder in the Finder/Explorer.
     *
     * @returns {Promise<boolean>}
     */
    public async openThemeFolder(): Promise<boolean> {
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
     * Opens the "add monaco theme" dialog
     */
    public handleAddTheme(): void {
      this.props.appState.toggleAddMonacoThemeDialog();
    }

    public handleThemeSource(event: React.FormEvent<HTMLInputElement>): void {
      const { appState } = this.props;
      const { checked } = event.currentTarget;
      appState.isUsingSystemTheme = checked;
    }

    public render() {
      const { selectedTheme } = this.state;
      const { isUsingSystemTheme } = this.props.appState;
      const selectedName =
        (selectedTheme && selectedTheme.name) || 'Select a theme';

      return (
        <div className="settings-appearance">
          <h3>Appearance</h3>
          <Checkbox
            label="Sync theme with system setting"
            checked={isUsingSystemTheme}
            onChange={this.handleThemeSource}
          />
          <FormGroup
            label="Choose your theme"
            labelFor="open-theme-selector"
            disabled={isUsingSystemTheme}
            inline={true}
          >
            <ThemeSelect
              filterable={true}
              disabled={isUsingSystemTheme}
              items={this.state.themes}
              activeItem={selectedTheme}
              itemRenderer={renderItem}
              itemPredicate={filterItem}
              onItemSelect={this.handleChange}
              popoverProps={{
                onClosed: () => this.props.toggleHasPopoverOpen(),
              }}
              noResults={<MenuItem disabled={true} text="No results." />}
            >
              <Button
                id="open-theme-selector"
                text={selectedName}
                icon="tint"
                onClick={() => this.props.toggleHasPopoverOpen()}
                disabled={isUsingSystemTheme}
              />
            </ThemeSelect>
          </FormGroup>
          <Callout hidden={isUsingSystemTheme}>
            <p>
              To add themes, add JSON theme files to{' '}
              <a id="open-theme-folder" onClick={this.openThemeFolder}>
                <code>{THEMES_PATH}</code>
              </a>
              . The easiest way to get started is to clone one of the two
              existing themes and to add your own colors.
            </p>
            <p>
              Additionally, if you wish to import a Monaco Editor theme, pick
              your JSON file and Fiddle will attempt to import it.
            </p>
            <Button
              onClick={this.createNewThemeFromCurrent}
              text="Create theme from current selection"
              icon="duplicate"
            />
            <Button
              icon="document-open"
              onClick={this.handleAddTheme}
              text="Add a Monaco Editor theme"
            />
          </Callout>
        </div>
      );
    }
  },
);
