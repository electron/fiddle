import * as React from 'react';
import * as classNames from 'classnames';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { ElectronSettings } from './settings-electron';

enum SettingsSections {
  GitHub = 'GitHub',
  Electron = 'Electron',
  Credits = 'Credits'
}

const settingsSections = [
  SettingsSections.Electron,
  SettingsSections.GitHub,
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
      section: SettingsSections.Electron
    };
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

    if (section === SettingsSections.Electron) {
      return <ElectronSettings appState={appState} />;
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
      const className = classNames({ selected: isSelected });
      const onClick = ()   => this.setState({ section: name });

      return (
        <li onClick={onClick} key={name} className={className}>{name}</li>
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
          {this.renderContent()}
        </div>
      </div>
    );
  }
}
