import { clipboard, shell } from 'electron';
import * as React from 'react';
import { observer } from 'mobx-react';
import Icon from '@fortawesome/react-fontawesome';
import { faKey, faSpinner } from '@fortawesome/fontawesome-free-solid';

import { AppState } from '../state';
import { getOctokit } from '../../utils/octokit';
import { classNames } from '../../utils/classnames';

export interface TokenDialogProps {
  appState: AppState;
}

export interface TokenDialogState {
  tokenInput?: string;
  verifying: boolean;
  error: boolean;
}

const TOKEN_SCOPES = [ 'gist' ].join();
const TOKEN_DESCRIPTION = encodeURIComponent('Fiddle Gist Token');
const GENERATE_TOKEN_URL = `https://github.com/settings/tokens/new?scopes=${TOKEN_SCOPES}&description=${TOKEN_DESCRIPTION}`;

/**
 * The token dialog asks the user for a GitHub Personal Access Token.
 * It's also responsible for checking if the token is correct.
 *
 * @export
 * @class TokenDialog
 * @extends {React.Component<TokenDialogProps, TokenDialogState>}
 */
@observer
export class TokenDialog extends React.Component<TokenDialogProps, TokenDialogState> {
  private tokenInputRef: React.RefObject<HTMLInputElement>;

  constructor(props: TokenDialogProps) {
    super(props);

    this.state = {
      verifying: false,
      error: false,
    };
    this.tokenInputRef = React.createRef();
    this.onSubmitToken = this.onSubmitToken.bind(this);
    this.openGenerateTokenExternal = this.openGenerateTokenExternal.bind(this);
    this.onTokenInputFocused = this.onTokenInputFocused.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.close = this.close.bind(this);
  }

  /**
   * Handles the submission of a token
   *
   * @returns {Promise<void>}
   * @memberof TokenDialog
   */
  public async onSubmitToken(): Promise<void> {
    if (!this.state.tokenInput) return;
    this.setState({
      verifying: true,
    });

    const octo = await getOctokit();
    octo.authenticate({
      type: 'token',
      token: this.state.tokenInput || '',
    });

    try {
      const { data } = await octo.users.get({});
      this.props.appState.gitHubAvatarUrl = data.avatar_url;
      this.props.appState.gitHubLogin = data.login;
      this.props.appState.gitHubName = data.name;
    } catch (error) {
      console.warn(`Authenticating against GitHub failed`, error);
      this.setState({ verifying: false, error: true });
      return;
    }

    this.props.appState.gitHubToken = this.state.tokenInput;
    this.props.appState.isTokenDialogShowing = false;

    this.setState({ verifying: false, error: false });
  }

  /**
   * Closes the dialog
   */
  public close() {
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
      tokenInput: ''
    });
  }

  /**
   * Opens GitHub's page for token generation
   *
   * @memberof TokenDialog
   */
  public openGenerateTokenExternal() {
    shell.openExternal(GENERATE_TOKEN_URL);
  }

  /**
   * When the input field receives focus, we check the clipboard.
   * Maybe there's already something token-like there!
   *
   * @returns
   * @memberof TokenDialog
   */
  public onTokenInputFocused() {
    const text = clipboard.readText();

    if (text.length !== 40) return;
    if (!/[a-z0-9]+/.test(text)) return;

    this.setState({ tokenInput: text });
  }

  /**
   * Handle the change event, which usually just updates the address bar's value
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * @memberof AddressBar
   */
  public handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ tokenInput: event.target.value });
  }

  /**
   * A spinner element!
   *
   * @readonly
   */
  get spinner() {
    if (!this.state.verifying) return null;

    return (
      <div className='tokenSpinner'>
        <Icon icon={faSpinner} spin={true} />
      </div>
    );
  }

  public render() {
    const { isTokenDialogShowing } = this.props.appState;
    const canSubmit = !!this.state.tokenInput;
    const dialogClassNames = classNames({ tokenDialogVisible: isTokenDialogShowing }, 'tokenDialog');

    return isTokenDialogShowing ? [
      (
        <div
          key='drop'
          className={`dialogDrop ${isTokenDialogShowing ? 'dialogDropVisible' : ''}`}
          onClick={this.close}
        />
      ),
      (
        <div key='tokenDialog' className={dialogClassNames}>
          {this.spinner}
          <span className='generateTokenText'>
            <Icon icon={faKey} />
            Generate a <a onClick={this.openGenerateTokenExternal}>GitHub Personal Access Token</a> and paste it here:
          </span>
          <input
            ref={this.tokenInputRef}
            value={this.state.tokenInput || ''}
            onFocus={this.onTokenInputFocused}
            onChange={this.handleChange}
            className={this.state.error ? 'hasError' : ''}
          />
          <button
            className='button'
            disabled={!canSubmit}
            onClick={this.onSubmitToken}
          >
            Done
          </button>
          <button className='cancel' onClick={this.close}>Cancel</button>
        </div>
      )
    ] : null;
  }
}
