import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { clipboard, shell } from 'electron';
import { observer } from 'mobx-react';
import * as React from 'react';

import { getOctokit } from '../../utils/octokit';
import { AppState } from '../state';
import { Dialog } from './dialog';

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
    this.onClose = this.onClose.bind(this);
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
    const text = (clipboard.readText() || '').trim();

    if (text.length !== 40) return;
    if (!/^[a-z0-9]+$/.test(text)) return;

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
        <FontAwesomeIcon icon='spinner' spin={true} />
      </div>
    );
  }

  get buttons() {
    const canSubmit = !!this.state.tokenInput;

    return [
      (
        <button
          key='done'
          type='submit'
          className='button'
          disabled={!canSubmit}
          onClick={this.onSubmitToken}
        >
          Done
        </button>
      ), (
        <button key='cancel' className='cancel' onClick={this.onClose}>Cancel</button>
      )
    ];
  }

  public render() {
    const { isTokenDialogShowing } = this.props.appState;

    return (
      <Dialog
        isShowing={isTokenDialogShowing}
        isShowingBackdrop={true}
        buttons={this.buttons}
        onClose={this.onClose}
        isCentered={true}
        className='tokenDialog'
        key='tokenDialog'
      >
        {this.spinner}
        <span className='generateTokenText'>
          <FontAwesomeIcon icon='key' />
          Generate a <a onClick={this.openGenerateTokenExternal}>GitHub Personal Access Token</a> and paste it here:
        </span>

        {this.state.error ? <h5 className='error-text'>Please provide a valid GitHub Personal Access Token</h5> : null}

        <input
          ref={this.tokenInputRef}
          value={this.state.tokenInput || ''}
          onFocus={this.onTokenInputFocused}
          onChange={this.handleChange}
          className={this.state.error ? 'hasError' : ''}
        />
      </Dialog>
    );
  }
}
