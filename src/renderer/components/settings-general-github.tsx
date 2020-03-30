import { Button, Callout } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';

export interface GitHubSettingsProps {
  appState: AppState;
}

/**
 * Settings content to manage GitHub-related preferences.
 *
 * @class GitHubSettings
 * @extends {React.Component<GitHubSettingsProps, {}>}
 */
@observer
export class GitHubSettings extends React.Component<GitHubSettingsProps, {}> {
  constructor(props: GitHubSettingsProps) {
    super(props);

    this.signIn = this.signIn.bind(this);
  }

  /**
   * Render the "logged out" settings experience.
   *
   * @returns {JSX.Element}
   */
  public renderNotSignedIn(): JSX.Element {
    return (
      <Callout>
        <p>
          Your fiddles can be published as GitHub Gists -
          that way you can share your fiddles with the world!
        </p>
        <Button onClick={this.signIn} icon='log-in' text='Sign in'/>
      </Callout>
    );
  }

  /**
   * Render the "logged in" settings experience.
   *
   * @returns {JSX.Element}
   */
  public renderSignedIn(): JSX.Element {
    const { gitHubLogin } = this.props.appState;
    const signOut = this.props.appState.signOutGitHub;

    return (
      <Callout>
        <p>
          Your fiddles can be published as public GitHub Gists.
          Using the personal access token you gave us, we
          logged you into GitHub as <code>{gitHubLogin}</code>.
        </p>
        <Button onClick={signOut} icon='log-out' text='Sign out'/>
      </Callout>
    );
  }

  public render() {
    const { gitHubToken } = this.props.appState;

    const maybeSignedIn = !!gitHubToken
      ? this.renderSignedIn()
      : this.renderNotSignedIn();

    return (
      <div>
        <h4>GitHub</h4>
        {maybeSignedIn}
      </div>
    );
  }

  /**
   * Simply shows the GitHub Token dialog.``
   */
  private signIn() {
    this.props.appState.isTokenDialogShowing = true;
  }
}
