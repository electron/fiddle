import * as React from 'react';

import { Icon, IconName, MenuItem } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { CreditsSettings } from './settings-credits';
import { ElectronSettings } from './settings-electron';
import { ExecutionSettings } from './settings-execution';
import { GeneralSettings } from './settings-general';

enum SettingsSections {
  General = 'General',
  Electron = 'Electron',
  Execution = 'Execution',
  Credits = 'Credits',
}

const settingsSections = [
  SettingsSections.General,
  SettingsSections.Electron,
  SettingsSections.Execution,
  SettingsSections.Credits,
];

interface SettingsProps {
  appState: AppState;
}

interface SettingsState {
  section: SettingsSections;
  hasPopoverOpen: boolean;
}

/**
 * Everything above the editors, so buttons and the address bar.
 *
 * @class Settings
 * @extends {React.Component<SettingsProps, SettingsState>}
 */
export const Settings = observer(
  class Settings extends React.Component<SettingsProps, SettingsState> {
    constructor(props: SettingsProps) {
      super(props);

      this.state = {
        section: SettingsSections.General,
        hasPopoverOpen: false,
      };

      this.closeSettingsPanel = this.closeSettingsPanel.bind(this);
    }

    public componentDidMount() {
      window.addEventListener('keyup', this.closeSettingsPanel, true);
    }

    public componentWillUnmount() {
      window.removeEventListener('keyup', this.closeSettingsPanel, true);
    }

    /**
     * Renders the content of the settings, usually by simply
     * return the appropriate component.
     *
     * @returns {(JSX.Element | null)}
     */
    public renderContent(): JSX.Element | null {
      const { section } = this.state;
      const { appState } = this.props;

      if (section === SettingsSections.General) {
        return (
          <GeneralSettings
            appState={appState}
            toggleHasPopoverOpen={() => this.toggleHasPopoverOpen()}
          />
        );
      }

      if (section === SettingsSections.Electron) {
        return <ElectronSettings appState={appState} />;
      }

      if (section === SettingsSections.Execution) {
        return <ExecutionSettings appState={appState} />;
      }

      if (section === SettingsSections.Credits) {
        return <CreditsSettings appState={appState} />;
      }

      return null;
    }

    /**
     * Renders the individual menu items
     *
     * @returns {Array<JSX.Element>}
     */
    public renderOptions(): Array<JSX.Element> {
      const { section } = this.state;

      return settingsSections.map((name) => {
        const isSelected = section === name;
        const onClick = () => this.setState({ section: name });

        return (
          <MenuItem
            onClick={onClick}
            active={isSelected}
            key={name}
            id={`settings-link-${name}`}
            text={name}
            icon={this.getIconForSection(name)}
          />
        );
      });
    }

    public render() {
      const { appState } = this.props;
      const { isSettingsShowing } = appState;

      if (!isSettingsShowing) return null;

      return (
        <div className="settings">
          <div className="settings-menu">
            <ul>{this.renderOptions()}</ul>
          </div>
          <div className="settings-content">
            <button
              className="settings-close"
              onClick={appState.toggleSettings}
            >
              <Icon icon="cross" iconSize={25} />
            </button>
            {this.renderContent()}
          </div>
        </div>
      );
    }

    /**
     * Get the settings icons
     *
     * @param {SettingsSections} section
     * @returns {IconName}
     * @memberof Settings
     */
    private getIconForSection(section: SettingsSections): IconName {
      if (section === SettingsSections.Credits) {
        return 'heart';
      } else if (section === SettingsSections.Electron) {
        return 'floppy-disk';
      } else if (section === SettingsSections.Execution) {
        return 'play';
      }

      return 'cog';
    }

    /**
     * Trigger closing of the settings panel upon Esc
     * If hasPopoverOpen is set to true, settings will not close as only the popover should close
     *
     * @param {KeyboardEvent} event
     */
    private closeSettingsPanel(event: KeyboardEvent) {
      const { appState } = this.props;
      if (event.code === 'Escape' && !this.state.hasPopoverOpen) {
        appState.isSettingsShowing = false;
      }
    }

    /**
     * Toggles whether there is a popover open
     */
    public toggleHasPopoverOpen(): void {
      this.setState({
        ...this.state,
        hasPopoverOpen: !this.state.hasPopoverOpen,
      });
    }
  },
);
