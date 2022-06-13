import { Callout, Card } from '@blueprintjs/core';
import { shell } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as React from 'react';

import { AppState } from '../state';

interface CreditsSettingsProps {
  appState: AppState;
}

interface CreditsSettingsState {
  contributors: Array<Contributor>;
}

interface Contributor {
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
export class CreditsSettings extends React.Component<
  CreditsSettingsProps,
  CreditsSettingsState
> {
  constructor(props: CreditsSettingsProps) {
    super(props);

    this.state = {
      contributors: [],
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
      const onClick = () => shell.openExternal(url);

      return (
        <Card
          interactive={true}
          key={login}
          className="contributor"
          elevation={2}
          onClick={onClick}
        >
          <div className="header">
            <img src={avatar} alt="avatar" className="avatar" />
            <div className="info">
              <p className="name">{name || login}</p>
              {location && <p className="location">📍 {location}</p>}
            </div>
          </div>
          {bio && <p className="bio">{bio}</p>}
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
        <div className="contributors">{this.renderContributors()}</div>
      </div>
    );
  }

  public async getContributors() {
    try {
      const contributorsFile = path.join(
        __dirname,
        '../../static/contributors.json',
      );
      const contributors = await fs.readJSON(contributorsFile);
      this.setState({ contributors });
    } catch (error) {
      console.warn(`CreditsSettings: Fetching contributors failed`, error);
    }
  }
}
