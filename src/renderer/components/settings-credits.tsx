import { shell } from 'electron';
import * as React from 'react';

import { AppState } from '../state';

export interface CreditsSettingsProps {
  appState: AppState;
  contributors?: Array<any>;
}

/**
 * Settings content to manage Credits-related preferences.
 *
 * @class CreditsSettings
 * @extends {React.Component<CreditsSettingsProps, {}>}
 */
export class CreditsSettings extends React.Component<CreditsSettingsProps, {}> {
  private contributors: Array<any> | null = null;

  /**
   * Renders a list of contributors of Electron Fiddle.
   *
   * @returns {Array<JSX.Element>}
   */
  public renderContributors(): Array<JSX.Element> {
    this.contributors = this.contributors
      || this.props.contributors
      || require('../../../static/contributors.json');

    if (!this.contributors || !Array.isArray(this.contributors)) {
      return [];
    }

    return this.contributors.map(({ name, avatar, url, login, location, bio }) => {
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
          Electron Fiddle is, just like Electron, a free open source project
          welcoming contributors of all genders, cultures, and backgrounds. We
          would like to thank those who helped to make Electron Fiddle:
        </p>
        <div className='contributors'>
          {this.renderContributors()}
        </div>
      </div>
    );
  }
}
