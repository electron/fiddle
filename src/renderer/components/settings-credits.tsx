import * as React from 'react';

import { Callout, Card } from '@blueprintjs/core';
import { shell } from 'electron';

import { Contributor } from 'src/interfaces';

import contributorsJSON from '../../../static/contributors.json';
import { AppState } from '../state';

interface CreditsSettingsProps {
  appState: AppState;
}

interface CreditsSettingsState {
  contributors: Array<Contributor>;
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
      contributors: contributorsJSON as Array<Contributor>,
    };
  }

  /**
   * Renders a list of contributors of Electron Fiddle.
   *
   * @returns {Array<JSX.Element>}
   */
  public renderContributors(): Array<JSX.Element> {
    const { contributors } = this.state;

    return contributors.map(({ name, avatar, url, login, location, bio }) => {
      const maybeLocation = location ? (
        <p className="location">📍 {location}</p>
      ) : null;
      const maybeBio = bio ? <small className="bio">{bio}</small> : null;
      const style: React.CSSProperties = {
        backgroundImage: `url(${avatar})`,
      };
      const onClick = () => shell.openExternal(url);

      return (
        <Card
          interactive={true}
          key={login}
          className="contributor"
          onClick={onClick}
        >
          <div className="avatar" style={style} />
          <div className="details">
            <h2 className="name">{name || login}</h2>
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
        <h1>Credits</h1>
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
}
