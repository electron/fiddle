import * as React from 'react';
import { observer } from 'mobx-react';
import * as Octokit from '@octokit/rest';
import * as Icon from '@fortawesome/react-fontawesome';
import { faUpload, faSpinner } from '@fortawesome/fontawesome-free-solid';
import * as classNames from 'classnames';

import { AppState } from '../state';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../../constants';
import { when } from 'mobx';
import { ipcRendererManager } from '../ipc';
import { IpcEvents } from '../../ipc-events';

export interface PublishButtonProps {
  appState: AppState;
}

export interface PublishButtonState {
  isPublishing: boolean;
}

/**
 * The "publish" button takes care of logging you in.
 *
 * @export
 * @class PublishButton
 * @extends {React.Component<PublishButtonProps, PublishButtonState>}
 */
@observer
export class PublishButton extends React.Component<PublishButtonProps, PublishButtonState> {
  constructor(props: PublishButtonProps) {
    super(props);

    this.state = { isPublishing: false };
    this.handleClick = this.handleClick.bind(this);
    this.publishFiddle = this.publishFiddle.bind(this);
  }

  public componentDidMount() {
    ipcRendererManager.on(IpcEvents.FS_SAVE_FIDDLE_GIST, this.handleClick);
  }

  /**
   * When the user clicks the publish button, we either show the
   * authentication dialog or publish right away.
   *
   * If we're showing the authentication dialog, we wait for it
   * to be closed again (or a GitHub token to show up) before
   * we publish
   *
   * @returns {Promise<void>}
   * @memberof PublishButton
   */
  public async handleClick(): Promise<void> {
    const { appState } = this.props;

    if (!appState.gitHubToken) {
      appState.toggleAuthDialog();
    }

    // Wait for the dialog to be closed again
    await when(() => !!appState.gitHubToken || !appState.isTokenDialogShowing);

    if (appState.gitHubToken) {
      return this.publishFiddle();
    }
  }

  /**
   * Connect with GitHub, publish the current fiddle as a gist,
   * and update all related properties in the app state.
   */
  public async publishFiddle(): Promise<void> {
    this.setState({ isPublishing: true });

    const octo = new Octokit();
    octo.authenticate({
      type: 'token',
      token: this.props.appState.gitHubToken!
    });

    const options = { includeDependencies: true, includeElectron: true };
    const values = window.ElectronFiddle.app.getValues(options);

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

    console.log(`Publish Button: Publishing done`, { gist });
  }

  public render() {
    const { isPublishing } = this.state;
    const className = classNames('button', isPublishing);
    const icon = isPublishing ? faSpinner : faUpload;
    const text = isPublishing ? 'Publishing...' : 'Publish';

    return (
      <button className={className} onClick={this.handleClick} disabled={isPublishing}>
        <Icon icon={icon} spin={isPublishing} />
        <span style={{ marginLeft: 8 }} />
        {text}
      </button>
    );
  }
}
