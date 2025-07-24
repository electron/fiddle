import * as React from 'react';

import { Button, Callout, Dialog, InputGroup, Intent } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { getOctokit } from '../utils/octokit';

interface TokenDialogProps {
  appState: AppState;
}

interface TokenDialogState {
  tokenInput: string;
  verifying: boolean;
  error: boolean;
  errorMessage?: string;
  isTokenUpdateAction?: boolean;
}

const TOKEN_SCOPES = ['gist'].join();
const TOKEN_DESCRIPTION = encodeURIComponent('Fiddle Gist Token');
const GENERATE_TOKEN_URL = `https://github.com/settings/tokens/new?scopes=${TOKEN_SCOPES}&description=${TOKEN_DESCRIPTION}`;
const TOKEN_PATTERN =
  /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})$/;

/**
 * The token dialog asks the user for a GitHub Personal Access Token.
 * It's also responsible for checking if the token is correct.
 */
export const TokenDialog = observer(
  class TokenDialog extends React.Component<
    TokenDialogProps,
    TokenDialogState
  > {
    constructor(props: TokenDialogProps) {
      super(props);

      this.state = {
        verifying: false,
        error: false,
        errorMessage: undefined,
        tokenInput: '',
        isTokenUpdateAction: props.appState.gitHubToken !== '',
      };

      this.onSubmitToken = this.onSubmitToken.bind(this);
      this.openGenerateTokenExternal =
        this.openGenerateTokenExternal.bind(this);
      this.onTokenInputFocused = this.onTokenInputFocused.bind(this);
      this.handleChange = this.handleChange.bind(this);
      this.onClose = this.onClose.bind(this);
    }

    /**
     * Validates a GitHub token and checks for required scopes.
     */
    private async validateGitHubToken(token: string): Promise<{
      isValid: boolean;
      scopes: string[];
      hasGistScope: boolean;
      user?: any;
      error?: string;
    }> {
      try {
        const octokit = await getOctokit({ gitHubToken: token } as AppState);
        const response = await octokit.users.getAuthenticated();

        const scopes = response.headers['x-oauth-scopes']?.split(', ') || [];
        const hasGistScope = scopes.includes('gist');

        return {
          isValid: true,
          scopes,
          hasGistScope,
          user: response.data,
        };
      } catch (error) {
        return {
          isValid: false,
          scopes: [],
          hasGistScope: false,
          error: error.message,
        };
      }
    }

    /**
     * Handles the submission of a token and verifies
     * that it has the correct scopes.
     */
    public async onSubmitToken(): Promise<void> {
      if (!this.state.tokenInput) return;
      this.setState({ verifying: true, error: false, errorMessage: undefined });

      const validation = await this.validateGitHubToken(this.state.tokenInput);

      if (!validation.isValid) {
        console.warn(`Authenticating against GitHub failed`, validation.error);
        this.setState({
          verifying: false,
          error: true,
          errorMessage:
            'Invalid GitHub token. Please check your token and try again.',
        });
        if (!this.state.isTokenUpdateAction) {
          this.props.appState.gitHubToken = null;
        }
        return;
      }

      if (!validation.hasGistScope) {
        console.warn(`Token missing required gist scope`);
        this.setState({
          verifying: false,
          error: true,
          errorMessage:
            'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
        });
        if (!this.state.isTokenUpdateAction) {
          this.props.appState.gitHubToken = null;
        }
        return;
      }

      // Token is valid and has required scopes.
      this.props.appState.gitHubToken = this.state.tokenInput;
      this.props.appState.gitHubAvatarUrl = validation.user.avatar_url;
      this.props.appState.gitHubLogin = validation.user.login;
      this.props.appState.gitHubName = validation.user.name;

      this.setState({ verifying: false, error: false });
      this.props.appState.isTokenDialogShowing = false;
    }

    /**
     * Closes the dialog
     */
    public onClose() {
      this.props.appState.isTokenDialogShowing = false;
      this.reset();
    }

    /**
     * Reset this component's state
     */
    public reset(): void {
      this.setState({
        verifying: false,
        error: false,
        errorMessage: undefined,
        tokenInput: '',
        isTokenUpdateAction: false,
      });
    }

    /**
     * Opens GitHub's page for token generation
     */
    public openGenerateTokenExternal() {
      window.open(GENERATE_TOKEN_URL);
    }

    /**
     * When the input field receives focus, we check the clipboard.
     * Maybe there's already something token-like there!
     */
    public async onTokenInputFocused() {
      const text = ((await navigator.clipboard.readText()) || '').trim();

      if (TOKEN_PATTERN.test(text)) {
        this.setState({ tokenInput: text });
      }
    }

    /**
     * Handle the change event, which usually just updates the address bar's value
     */
    public handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      this.setState({ tokenInput: event.target.value });
    }

    get buttons() {
      const canSubmit = !!this.state.tokenInput;

      return [
        <Button
          key="done"
          disabled={!canSubmit}
          onClick={this.onSubmitToken}
          loading={this.state.verifying}
          text="Done"
          icon="log-in"
        />,
        <Button
          key="cancel"
          text="Cancel"
          icon="log-out"
          onClick={this.onClose}
        />,
      ];
    }

    get invalidWarning() {
      const message =
        this.state.errorMessage ||
        'Please provide a valid GitHub Personal Access Token';
      return (
        <>
          <Callout intent={Intent.DANGER}>{message}</Callout>
          <br />
        </>
      );
    }

    public render() {
      const { isTokenDialogShowing } = this.props.appState;

      return (
        <Dialog
          isOpen={isTokenDialogShowing}
          onClose={this.onClose}
          title="GitHub Token"
        >
          <div className="bp3-dialog-body">
            <p>
              Generate a{' '}
              <a onClick={this.openGenerateTokenExternal}>
                GitHub Personal Access Token
              </a>{' '}
              and paste it here:
            </p>

            {this.state.error ? this.invalidWarning : null}

            <InputGroup
              value={this.state.tokenInput || ''}
              onFocus={this.onTokenInputFocused}
              onChange={this.handleChange}
            />
          </div>
          <div className="bp3-dialog-footer">
            <div className="bp3-dialog-footer-actions">{this.buttons}</div>
          </div>
        </Dialog>
      );
    }
  },
);
