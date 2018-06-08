import * as React from 'react';
import { observer } from 'mobx-react';
import * as Octokit from '@octokit/rest';
import * as Icon from '@fortawesome/react-fontawesome';
import { faUpload, faSpinner } from '@fortawesome/fontawesome-free-solid';
import * as classNames from 'classnames';

import { AppState } from '../app';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../constants';

export interface PublishButtonProps {
  appState: AppState;
}

export interface PublishButtonState {
  isPublishing: boolean;
}

@observer
export class PublishButton extends React.Component<PublishButtonProps, PublishButtonState> {
  constructor(props: PublishButtonProps) {
    super(props);

    this.state = { isPublishing: false };
    this.publishFiddle = this.publishFiddle.bind(this);
  }

  public async publishFiddle() {
    this.setState({ isPublishing: true });

    const octo = new Octokit();
    octo.authenticate({
      type: 'token',
      token: this.props.appState.githubToken!
    });

    const values = (window as any).electronFiddle.getValues();

    const gist = await octo.gists.create({
      public: true,
      description: 'Electron Fiddle Gist',
      files: {
        [INDEX_HTML_NAME]: {
          content: values.html || '<!-- Empty -->',
        },
        [MAIN_JS_NAME]: {
          content: values.main || '// Empty',
        },
        [RENDERER_JS_NAME]: {
          content: values.renderer || '// Empty',
        },
      },
    });

    this.setState({ isPublishing: false });
    this.props.appState.gistId = gist.data.id;
  }

  public render() {
    const { isPublishing } = this.state;
    const className = classNames('button', isPublishing);
    const icon = isPublishing ? faSpinner : faUpload;
    const text = isPublishing ? 'Publishing...' : 'Publish';

    return this.props.appState.githubToken ? (
      <button className={className} onClick={this.publishFiddle} disabled={isPublishing}>
        <Icon icon={icon} spin={isPublishing} />
        <span style={{ marginLeft: 8 }} />
        {text}
      </button>
    ) : null;
  }
}
