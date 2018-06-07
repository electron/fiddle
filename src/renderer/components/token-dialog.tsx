import { clipboard, shell } from 'electron';
import * as React from 'react';
import { observer } from 'mobx-react';
import * as Icon from '@fortawesome/react-fontawesome';
import { faKey } from '@fortawesome/fontawesome-free-solid';

import { AppState } from '../app';

export interface TokenDialogProps {
  appState: AppState;
}

export interface TokenDialogState {
  tokenInput?: string;
}

const TOKEN_SCOPES = [ 'gist' ].join();
const TOKEN_DESCRIPTION = encodeURIComponent('Fiddle Gist Token');
const GENERATE_TOKEN_URL = `https://github.com/settings/tokens/new?scopes=${TOKEN_SCOPES}&description=${TOKEN_DESCRIPTION}`;

@observer
export class TokenDialog extends React.Component<TokenDialogProps, TokenDialogState> {
  private tokenInputRef: React.RefObject<HTMLInputElement>;

  constructor(props: TokenDialogProps) {
    super(props);

    this.state = {};
    this.tokenInputRef = React.createRef();
    this.onSubmitToken = this.onSubmitToken.bind(this);
    this.openGenerateTokenExternal = this.openGenerateTokenExternal.bind(this);
    this.onTokenInputFocused = this.onTokenInputFocused.bind(this);
  }

  public onSubmitToken() {
    // TODO: Do more validation of the token
    if (!this.state.tokenInput) return;

    localStorage.setItem('githubToken', this.state.tokenInput);
    this.props.appState.githubToken = this.state.tokenInput;
    this.props.appState.isTokenDialogShowing = false;
  }

  public openGenerateTokenExternal() {
    shell.openExternal(GENERATE_TOKEN_URL);
  }

  public onTokenInputFocused() {
    this.setState({
      tokenInput: clipboard.readText()
    });
  }

  public render() {
    const canSubmit = !!this.state.tokenInput;
    return (
      <div className='tokenDialog'>
        <span className='generateTokenText'>
          <Icon icon={faKey} />
          Generate an access token from <a onClick={this.openGenerateTokenExternal}> GitHub </a> and paste it here:
        </span>
        <input
          readOnly={true}
          ref={this.tokenInputRef}
          value={this.state.tokenInput || ''}
          onFocus={this.onTokenInputFocused}
        />
        <button
          className='button'
          disabled={!canSubmit}
          onClick={this.onSubmitToken}
        >
          Done
        </button>
      </div>
    );
  }
}
