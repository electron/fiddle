import { faTimesCircle } from '@fortawesome/fontawesome-free-solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { observer } from 'mobx-react';
import * as React from 'react';

import { classNames } from '../../utils/classnames';
import { AppState } from '../state';
import { CreditsSettings } from './settings-credits';
import { ElectronSettings } from './settings-electron';
import { GeneralSettings } from './settings-general';

enum SettingsSections {
  General = 'General',
  Electron = 'Electron',
  Credits = 'Credits'
}

const settingsSections = [
  SettingsSections.General,
  SettingsSections.Electron,
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
      const className = classNames({ selected: isSelected }, name);
      const onClick = () => this.setState({ section: name });

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
          <div className='settings-close' onClick={appState.toggleSettings}>
            <FontAwesomeIcon icon={faTimesCircle} />
          </div>
          {this.renderContent()}
        </div>
      </div>
    );
  }
}
