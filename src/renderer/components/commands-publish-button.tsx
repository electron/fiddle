import { Button, ButtonGroup, IToastProps, Menu, MenuItem, Popover, Position, Toaster } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { when } from 'mobx';
import { EditorValues } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import { INDEX_HTML_NAME, MAIN_JS_NAME, PRELOAD_JS_NAME, RENDERER_JS_NAME, STYLES_CSS_NAME } from '../../shared-constants';
import { getOctokit } from '../../utils/octokit';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';
import { EMPTY_EDITOR_CONTENT } from '../constants';

export interface PublishButtonProps {
  appState: AppState;
}

interface IPublishButtonState {
  readonly isUpdating: boolean;
}

/**
 * The "publish" button takes care of logging you in.
 *
 * @export
 * @class PublishButton
 * @extends {React.Component<PublishButtonProps, PublishButtonState>}
 */
@observer
export class PublishButton extends React.Component<PublishButtonProps, IPublishButtonState> {
  public constructor(props: PublishButtonProps) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.publishOrUpdateFiddle = this.publishOrUpdateFiddle.bind(this);
    this.setPrivate = this.setPrivate.bind(this);
    this.setPublic = this.setPublic.bind(this);

    this.state = {
      isUpdating: false
    };
  }

  private toaster: Toaster;
  private refHandlers = {
    toaster: (ref: Toaster) => this.toaster = ref,
  };

  public componentDidMount() {
    ipcRendererManager.on(IpcEvents.FS_SAVE_FIDDLE_GIST, this.handleClick);
  }

  public componentWillUnmount() {
    ipcRendererManager.off(IpcEvents.FS_SAVE_FIDDLE_GIST, this.handleClick);
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
      return this.publishOrUpdateFiddle();
    }
  }

  /**
   * Connect with GitHub, publish the current Fiddle as a gist,
   * and update all related properties in the app state.
   */
  public async publishOrUpdateFiddle(): Promise<void> {
    const { appState } = this.props;
    appState.isPublishing = true;

    const octo = await getOctokit(this.props.appState);
    const { gitHubPublishAsPublic, gistId } = this.props.appState;
    const options = { includeDependencies: true, includeElectron: true };
    const values = await window.ElectronFiddle.app.getEditorValues(options);

    if (gistId) {
      this.setState({
        isUpdating: true
      });
      const gist = await octo.gists.update({
        gist_id: appState.gistId,
        files: this.gistFilesList(values) as any,
      });

      console.log('Updating: Updating done', { gist });
      this.renderToast({ message: 'Successfully updated gist!' });
      this.setState({
        isUpdating: false
      });
    } else {
      try {
        const gist = await octo.gists.create({
          public: !!gitHubPublishAsPublic,
          description: 'Electron Fiddle Gist',
          files: this.gistFilesList(values) as any, // Note: GitHub messed up, GistsCreateParamsFiles is an incorrect interface
        });

        appState.gistId = gist.data.id;

        console.log(`Publish Button: Publishing done`, { gist });
        this.renderToast({ message: 'Publishing done successfully!' });
      } catch (error) {
        console.warn(`Could not publish gist`, { error });

        const messageBoxOptions: Electron.MessageBoxOptions = {
          message: 'Publishing Fiddle to GitHub failed. Are you connected to the Internet?',
          detail: `GitHub encountered the following error: ${error.message}`
        };

        ipcRendererManager.send(IpcEvents.SHOW_WARNING_DIALOG, messageBoxOptions);
      }
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
    const { isPublishing, gistId } = this.props.appState;
    const { isUpdating } = this.state;

    const getTextForButton = gistId
      ? 'Update'
      : isUpdating
      ? 'Updating...'
      : isPublishing
      ? 'Publishing...'
      : 'Publish';

    return (
      <>
        <fieldset disabled={isPublishing}>
          <ButtonGroup className='button-publish'>
              {this.renderPrivaryMenu()}
              <Button
                onClick={this.handleClick}
                loading={isPublishing}
                icon='upload'
                text={getTextForButton}
              />
          </ButtonGroup>
        </fieldset>
        <Toaster position={Position.BOTTOM_RIGHT} ref={this.refHandlers.toaster} />
      </>
    );
  }

  private renderPrivaryMenu = () => {
    const { gitHubPublishAsPublic, gistId } = this.props.appState;

    if (gistId) {
      return null;
    }

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
      <Popover
        content={privacyMenu}
        position={Position.BOTTOM}
      >
        <Button
          icon={privacyIcon}
        />
      </Popover>
    );
  }

  private setPrivacy(publishAsPublic: boolean) {
    this.props.appState.gitHubPublishAsPublic = publishAsPublic;
  }

  private renderToast = (toast: IToastProps) => {
    this.toaster.show(toast);
  }

  private gistFilesList = (values: EditorValues) => {
    return {
      [INDEX_HTML_NAME]: {
        content: values.html || EMPTY_EDITOR_CONTENT.html,
      },
      [MAIN_JS_NAME]: {
        content: values.main || EMPTY_EDITOR_CONTENT.js,
      },
      [RENDERER_JS_NAME]: {
        content: values.renderer || EMPTY_EDITOR_CONTENT.js,
      },
      [PRELOAD_JS_NAME]: {
        content: values.preload || EMPTY_EDITOR_CONTENT.js,
      },
      [STYLES_CSS_NAME]: {
        content: values.css || EMPTY_EDITOR_CONTENT.css,
      },
    };
  }
}
