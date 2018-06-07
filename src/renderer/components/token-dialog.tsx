import * as React from 'react';
import { observer } from 'mobx-react';

import { AppState } from '../app';

export interface TokenDialogProps {
  appState: AppState;
}

const TOKEN_SCOPES = [ 'gist' ].join();
const TOKEN_DESCRIPTION = encodeURIComponent('Fiddle Gist Token');
const GENERATE_TOKEN_URL = `https://github.com/settings/tokens/new?scopes=${TOKEN_SCOPES}&description=${TOKEN_DESCRIPTION}`;

@observer
export class TokenDialog extends React.Component<TokenDialogProps, {}> {
  public render() {
    return (
      <div className='tokenDialog'>
        <span>Please generate an access token from <a href={GENERATE_TOKEN_URL}>GitHub</a> and paste it here:</span>
        <input className='tokenInput' />
      </div>
    );
  }
}
