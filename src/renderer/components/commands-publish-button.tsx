import { Button, ButtonGroup, Menu, MenuItem, Popover, Position } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { when } from 'mobx';
import { IpcEvents } from '../../ipc-events';
import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../../shared-constants';
import { getOctokit } from '../../utils/octokit';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';

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
   * Connect with GitHub, publish the current Fiddle as a gist,
   * and update all related properties in the app state.
   */
  public async publishFiddle(): Promise<void> {
    this.setState({ isPublishing: true });

    const octo = await getOctokit();
    octo.authenticate({
      type: 'token',
      token: this.props.appState.gitHubToken!
    });

    const { gitHubPublishAsPublic } = this.props.appState;
    const options = { includeDependencies: true, includeElectron: true };
    const values = await window.ElectronFiddle.app.getValues(options);

    try {
      const gist = await octo.gists.create({
        public: !!gitHubPublishAsPublic,
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
      } as any); // Note: GitHub messed up, GistsCreateParamsFiles is an incorrect interface

      this.props.appState.gistId = gist.data.id;

      console.log(`Publish Button: Publishing done`, { gist });
    } catch (error) {
      console.warn(`Could not publish gist`, { error });

      const messageBoxOptions: Electron.MessageBoxOptions = {
        message: 'Publishing Fiddle to GitHub failed. Are you connected to the Internet?',
        detail: `GitHub encountered the following error: ${error.message}`
      };

      ipcRendererManager.send(IpcEvents.SHOW_WARNING_DIALOG, messageBoxOptions);
    }

    this.setState({ isPublishing: false });
  }

  public setPrivacy(publishAsPublic: boolean) {
    this.props.appState.gitHubPublishAsPublic = publishAsPublic;
  }

  public render() {
    const { gitHubPublishAsPublic } = this.props.appState;
    const { isPublishing } = this.state;

    const privacyIcon = gitHubPublishAsPublic ? 'unlock' : 'lock';
    const privacyMenu = (
      <Menu>
        <MenuItem
          text='Private'
          icon='lock'
          active={!gitHubPublishAsPublic}
          onClick={() => this.setPrivacy(false)}
        />
        <MenuItem
          text='Public'
          icon='unlock'
          active={gitHubPublishAsPublic}
          onClick={() => this.setPrivacy(true)}
        />
      </Menu>
    );

    return (
      <ButtonGroup className='button-publish'>
        <Popover
          content={privacyMenu}
          position={Position.BOTTOM}
          disabled={isPublishing}
        >
          <Button
            icon={privacyIcon}
          />
        </Popover>
        <Button
          onClick={this.handleClick}
          loading={isPublishing}
          disabled={isPublishing}
          icon='upload'
          text={isPublishing ? 'Publishing...' : 'Publish'}
        />
      </ButtonGroup>
    );
  }
}
