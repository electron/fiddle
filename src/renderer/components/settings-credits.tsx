import { Callout, Card } from '@blueprintjs/core';
import { shell } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as React from 'react';

import { AppState } from '../state';

export interface CreditsSettingsProps {
  appState: AppState;
}

export interface CreditsSettingsState {
  contributors: Array<Contributor>;
}

export interface Contributor {
  url: string;
  api: string;
  login: string;
  avatar: string;
  name: string;
  bio: string;
  location: string;
}

/**
 * Settings content to manage Credits-related preferences.
 *
 * @class CreditsSettings
 * @extends {React.Component<CreditsSettingsProps, CreditsSettingsState>}
 */
export class CreditsSettings extends React.Component<CreditsSettingsProps, CreditsSettingsState> {
  constructor(props: CreditsSettingsProps) {
    super(props);

    this.state = {
      contributors: []
    };

    this.getContributors();
  }

  /**
   * Renders a list of contributors of Electron Fiddle.
   *
   * @returns {Array<JSX.Element>}
   */
  public renderContributors(): Array<JSX.Element> {
    const { contributors } = this.state;

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
        <Card interactive={true} key={login} className='contributor' onClick={onClick}>
          <div className='avatar' style={style} />
          <div className='details'>
            <h5 className='name'>{name || login}</h5>
            {maybeLocation}
            {maybeBio}
          </div>
        </Card>
      );
    });
  }

  public render() {
    return (
      <div>
        <h2>Credits</h2>
        <Callout>
          Electron Fiddle is, just like Electron, a free open source project
          welcoming contributors of all genders, cultures, and backgrounds. We
          would like to thank those who helped to make Electron Fiddle:
        </Callout>
        <br />
        <div className='contributors'>
          {this.renderContributors()}
        </div>
      </div>
    );
  }

  public async getContributors() {
    try {
      const contributorsFile = path.join(__dirname, '../../static/contributors.json');
      const contributors = await fs.readJSON(contributorsFile);
      this.setState({ contributors });
    } catch (error) {
      console.warn(`CreditsSettings: Fetching contributors failed`, error);
    }
  }
}
