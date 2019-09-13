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

/**
 * The "publish" button takes care of logging you in.
 *
 * @export
 * @class PublishButton
 * @extends {React.Component<PublishButtonProps, PublishButtonState>}
 */
@observer
export class PublishButton extends React.Component<PublishButtonProps> {
  constructor(props: PublishButtonProps) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.publishFiddle = this.publishFiddle.bind(this);
    this.setPrivate = this.setPrivate.bind(this);
    this.setPublic = this.setPublic.bind(this);
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
    const { appState } = this.props;
    appState.isPublishing = true;

    const octo = await getOctokit(this.props.appState);
    const { gitHubPublishAsPublic } = this.props.appState;
    const options = { includeDependencies: true, includeElectron: true };
    const values = await window.ElectronFiddle.app.getEditorValues(options);

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

      appState.gistId = gist.data.id;

      console.log(`Publish Button: Publishing done`, { gist });
    } catch (error) {
      console.warn(`Could not publish gist`, { error });

      const messageBoxOptions: Electron.MessageBoxOptions = {
        message: 'Publishing Fiddle to GitHub failed. Are you connected to the Internet?',
        detail: `GitHub encountered the following error: ${error.message}`
      };

      ipcRendererManager.send(IpcEvents.SHOW_WARNING_DIALOG, messageBoxOptions);
    }

    appState.isPublishing = false;
  }

  /**
   * Publish fiddles as private.
   *
   * @memberof PublishButton
   */
  public setPrivate() {
    this.setPrivacy(false);
  }

  /**
   * Publish fiddles as public.
   *
   * @memberof PublishButton
   */
  public setPublic() {
    this.setPrivacy(true);
  }

  public render() {
    const { gitHubPublishAsPublic } = this.props.appState;
    const { isPublishing } = this.props.appState;

    const privacyIcon = gitHubPublishAsPublic ? 'unlock' : 'lock';
    const privacyMenu = (
      <Menu>
        <MenuItem
          text='Private'
          icon='lock'
          active={!gitHubPublishAsPublic}
          onClick={this.setPrivate}
        />
        <MenuItem
          text='Public'
          icon='unlock'
          active={gitHubPublishAsPublic}
          onClick={this.setPublic}
        />
      </Menu>
    );

    return (
      <fieldset disabled={isPublishing}>
        <ButtonGroup className='button-publish'>
            <Popover
              content={privacyMenu}
              position={Position.BOTTOM}
            >
              <Button
                icon={privacyIcon}
              />
            </Popover>
            <Button
              onClick={this.handleClick}
              loading={isPublishing}
              icon='upload'
              text={isPublishing ? 'Publishing...' : 'Publish'}
            />
        </ButtonGroup>
      </fieldset>
    );
  }

  private setPrivacy(publishAsPublic: boolean) {
    this.props.appState.gitHubPublishAsPublic = publishAsPublic;
  }
}
