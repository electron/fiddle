import * as React from 'react';
import { shell } from 'electron';
// import * as Icon from '@fortawesome/react-fontawesome';
// import { faSignInAlt, faSignOutAlt } from '@fortawesome/fontawesome-free-solid';

import { AppState } from '../state';

const contributors = require('../../../static/contributors.json');

export interface CreditsSettingsProps {
  appState: AppState;
}

/**
 * Settings content to manage Credits-related preferences.
 *
 * @class CreditsSettings
 * @extends {React.Component<CreditsSettingsProps, {}>}
 */
export class CreditsSettings extends React.Component<CreditsSettingsProps, {}> {
  /**
   * Renders a list of contributors of Electron Fiddle.
   *
   * @returns {Array<JSX.Element>}
   */
  public renderContributors(): Array<JSX.Element> {
    if (!contributors || !Array.isArray(contributors)) {
      return [];
    }

    return contributors.map(({ name, avatar, url, login, location, bio }) => {
      const maybeLocation = location
        ? <p className='location'>📍 {location}</p>
        : null;
      const maybeBio = bio
        ? <small className='bio'>{bio}</small>
        : null;
      const style: React.CSSProperties = {
        backgroundImage: `url(${avatar})`
      };
      const onClick = () => shell.openExternal(url);

      return (
        <div key={login} className='contributor' onClick={onClick}>
          <div className='avatar' style={style} />
          <div className='details'>
            <h5 className='name'>{name || login}</h5>
            {maybeLocation}
            {maybeBio}
          </div>
        </div>
      );
    });
  }

  public render() {
    return (
      <div>
        <h2>Credits</h2>
        <p>
          Electron Fiddle is, just like Electron, a free open source project brought
          to you by dedicated engineers of all genders, cultures, and backgrounds. We
          would like to thank those who contributed to Electron Fiddle:
        </p>
        <div className='contributors'>
          {this.renderContributors()}
        </div>
      </div>
    );
  }
}
