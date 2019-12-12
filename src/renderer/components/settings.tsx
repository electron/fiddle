import { Icon, IconName, MenuItem } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { CreditsSettings } from './settings-credits';
import { ElectronSettings } from './settings-electron';
import { ExecutionSettings } from './settings-execution';
import { GeneralSettings } from './settings-general';

enum SettingsSections {
  General = 'General',
  Electron = 'Electron',
  Execution = 'Execution',
  Credits = 'Credits'
}

const settingsSections = [
  SettingsSections.General,
  SettingsSections.Electron,
  SettingsSections.Execution,
  SettingsSections.Credits
];

export interface SettingsProps {
  appState: AppState;
}

export interface SettingsState {
  section: SettingsSections;
}

/**
 * Everything above the editors, so buttons and the address bar.
 *
 * @class Settings
 * @extends {React.Component<SettingsProps, SettingsState>}
 */
@observer
export class Settings extends React.Component<SettingsProps, SettingsState> {
  constructor(props: SettingsProps) {
    super(props);

    this.state = {
      section: SettingsSections.General
    };

    this.closeSettingsPanel = this.closeSettingsPanel.bind(this);
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.closeSettingsPanel, true);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.closeSettingsPanel);
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
      return <GeneralSettings appState={appState} />;
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
      <div className='settings'>
        <div className='settings-menu'>
          <ul>{this.renderOptions()}</ul>
        </div>
        <div className='settings-content'>
          <div className='settings-close' onClick={appState.toggleSettings}>
            <Icon icon='cross' />
          </div>
          {this.renderContent()}
        </div>
      </div>
    );
  }

  /**
   * Get the settings icons
   *
   * @param {SettingsSections} section
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
   */
  private closeSettingsPanel(event: KeyboardEvent) {
    const { appState } = this.props;
    if (event.code === 'Escape') {
      appState.isSettingsShowing = false;
    }
  }
}
