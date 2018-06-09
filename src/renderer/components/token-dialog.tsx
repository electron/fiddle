import { clipboard, shell } from 'electron';
import * as React from 'react';
import { observer } from 'mobx-react';
import * as Icon from '@fortawesome/react-fontawesome';
import { faKey, faSpinner } from '@fortawesome/fontawesome-free-solid';
import * as Octokit from '@octokit/rest';

import { AppState } from '../state';

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
    this.onTokenKeyDown = this.onTokenKeyDown.bind(this);
    this.close = this.close.bind(this);
  }

  public async onSubmitToken() {
    if (!this.state.tokenInput) return;
    this.setState({
      verifying: true,
    });

    const octo = new Octokit();
    octo.authenticate({
      type: 'token',
      token: this.state.tokenInput || '',
    });

    try {
      const { data } = await octo.users.get({});
      localStorage.setItem('avatarUrl', data.avatar_url);
    } catch (err) {
      this.setState({
        verifying: false,
        error: true,
      });
      return;
    }

    localStorage.setItem('githubToken', this.state.tokenInput);
    this.props.appState.githubToken = this.state.tokenInput;
    this.props.appState.isTokenDialogShowing = false;

    this.setState({
      verifying: false,
      error: false,
    });
  }

  public close() {
    this.props.appState.isTokenDialogShowing = false;
  }

  public openGenerateTokenExternal() {
    shell.openExternal(GENERATE_TOKEN_URL);
  }

  public onTokenInputFocused() {
    const text = clipboard.readText();

    if (text.length !== 40) return;
    if (!/[a-z0-9]+/.test(text)) return;

    this.setState({
      tokenInput: text,
    });
  }

  public onTokenKeyDown(event: React.KeyboardEvent<any>) {
    if (event.which !== 27) return;

    this.setState({
      tokenInput: '',
    });
  }

  get spinner() {
    if (!this.state.verifying) return null;

    return (
      <div className='tokenSpinner'>
        <Icon icon={faSpinner} spin={true} />
      </div>
    );
  }

  public render() {
    const canSubmit = !!this.state.tokenInput;
    return [
      (
        <div
          key='drop'
          className={`dialogDrop ${this.props.appState.isTokenDialogShowing ? 'dialogDropVisible' : ''}`}
          onClick={this.close}
        />
      ),
      (
        <div key='tokenDialog' className={`tokenDialog ${this.props.appState.isTokenDialogShowing ? 'tokenDialogVisible' : ''}`}>
          {this.spinner}
          <span className='generateTokenText'>
            <Icon icon={faKey} />
            Generate an access token from <a onClick={this.openGenerateTokenExternal}> GitHub </a> and paste it here:
          </span>
          <input
            readOnly={true}
            ref={this.tokenInputRef}
            value={this.state.tokenInput || ''}
            onFocus={this.onTokenInputFocused}
            onKeyDown={this.onTokenKeyDown}
            className={this.state.error ? 'hasError' : ''}
          />
          <button
            className='button'
            disabled={!canSubmit}
            onClick={this.onSubmitToken}
          >
            Done
          </button>
        </div>
      )
    ];
  }
}
