import * as React from 'react';

import { Button, Callout, Checkbox, FormGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { AppState } from '../state';

interface GitHubSettingsProps {
  appState: AppState;
}

/**
 * Settings content to manage GitHub-related preferences.
 *
 * @class GitHubSettings
 * @extends {React.Component<GitHubSettingsProps, {}>}
 */
export const GitHubSettings = observer(
  class GitHubSettings extends React.Component<GitHubSettingsProps> {
    constructor(props: GitHubSettingsProps) {
      super(props);

      this.signIn = this.signIn.bind(this);
      this.handlePublishGistAsRevisionChange = this.handlePublishGistAsRevisionChange.bind(
        this,
      );
    }

    private static publishGistAsRevisionInstructions = `
    Enable this option to always publish your fiddle as a revision of the
    default fiddle gist values.`.trim();

    /**
     * Render the "logged out" settings experience.
     *
     * @returns {JSX.Element}
     */
    public renderNotSignedIn(): JSX.Element {
      return (
        <Callout>
          <p>
            Your fiddles can be published as GitHub Gists - that way you can
            share your fiddles with the world!
          </p>
          <Button onClick={this.signIn} icon="log-in" text="Sign in" />
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
            Your fiddles can be published as public GitHub Gists. Using the
            personal access token you gave us, we logged you into GitHub as{' '}
            <code>{gitHubLogin}</code>.
          </p>
          <Button onClick={signOut} icon="log-out" text="Sign out" />
        </Callout>
      );
    }

    /**
     * Handles a change on whether or not the gist should be published
     * as a revision on top of the default fiddle gist.
     *
     * @param {React.FormEvent<HTMLInputElement>} event
     */
    public handlePublishGistAsRevisionChange(
      event: React.FormEvent<HTMLInputElement>,
    ) {
      const { checked } = event.currentTarget;
      this.props.appState.isPublishingGistAsRevision = checked;
    }

    public render() {
      const { gitHubToken } = this.props.appState;
      const { isPublishingGistAsRevision } = this.props.appState;

      const maybeSignedIn = !!gitHubToken
        ? this.renderSignedIn()
        : this.renderNotSignedIn();

      return (
        <div>
          <h4>GitHub</h4>
          {maybeSignedIn}
          <Callout>
            <FormGroup>
              <p>{GitHubSettings.publishGistAsRevisionInstructions}</p>
              <Checkbox
                checked={isPublishingGistAsRevision}
                label="Publish as revision."
                onChange={this.handlePublishGistAsRevisionChange}
              />
            </FormGroup>
          </Callout>
        </div>
      );
    }

    /**
     * Simply shows the GitHub Token dialog.``
     */
    private signIn() {
      this.props.appState.isTokenDialogShowing = true;
    }
  },
);
