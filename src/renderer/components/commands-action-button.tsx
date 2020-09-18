import {
  Button,
  ButtonGroup,
  IToastProps,
  Menu,
  MenuItem,
  Popover,
  Position,
  Toaster,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { when } from 'mobx';
import { EditorValues, GistActionType } from '../../interfaces';
import { IpcEvents } from '../../ipc-events';
import {
  INDEX_HTML_NAME,
  MAIN_JS_NAME,
  PRELOAD_JS_NAME,
  RENDERER_JS_NAME,
  STYLES_CSS_NAME,
} from '../../shared-constants';
import { getOctokit } from '../../utils/octokit';
import { EMPTY_EDITOR_CONTENT } from '../constants';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';

export interface GistActionButtonProps {
  appState: AppState;
}

interface IGistActionButtonState {
  readonly isUpdating: boolean;
  readonly isDeleting: boolean;
  readonly actionType: GistActionType;
}

/**
 * The "publish" button takes care of logging you in.
 *
 * @export
 * @class GistActionButton
 * @extends {React.Component<GistActionButtonProps, GistActionButtonState>}
 */
@observer
export class GistActionButton extends React.Component<
  GistActionButtonProps,
  IGistActionButtonState
> {
  public constructor(props: GistActionButtonProps) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.performGistAction = this.performGistAction.bind(this);
    this.setPrivate = this.setPrivate.bind(this);
    this.setPublic = this.setPublic.bind(this);

    this.state = {
      isUpdating: false,
      isDeleting: false,
      actionType: GistActionType.publish,
    };
  }

  private toaster: Toaster;
  private refHandlers = {
    toaster: (ref: Toaster) => (this.toaster = ref),
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
   * @memberof GistActionButton
   */
  public async handleClick(): Promise<void> {
    const { appState } = this.props;

    if (!appState.gitHubToken) {
      appState.toggleAuthDialog();
    }

    // Wait for the dialog to be closed again
    await when(() => !!appState.gitHubToken || !appState.isTokenDialogShowing);

    if (appState.gitHubToken) {
      return this.performGistAction();
    }
  }

  /**
   * Connect with GitHub, publish the current Fiddle as a gist,
   * and update all related properties in the app state.
   */
  public async performGistAction(): Promise<void> {
    console.log('publishOrUpdateFiddle()');
    const { appState } = this.props;
    const { actionType } = this.state;
    appState.isPublishing = true;

    const octo = await getOctokit(this.props.appState);
    const { gitHubPublishAsPublic, gistId } = this.props.appState;
    const options = { includeDependencies: true, includeElectron: true };
    const values = await window.ElectronFiddle.app.getEditorValues(options);

    if (gistId) {
      if (actionType === GistActionType.update) {
        this.setState({ isUpdating: true });
        try {
          const gist = await octo.gists.update({
            gist_id: appState.gistId!,
            files: this.gistFilesList(values) as any,
          });

          console.log('Updating: Updating done', { gist });
          this.renderToast({ message: 'Successfully updated gist!' });
        } catch (error) {
          console.warn(`Could not update gist`, { error });

          const messageBoxOptions: Electron.MessageBoxOptions = {
            message:
              'Updating Fiddle Gist failed. Are you connected to the Internet and is this your Gist?',
            detail: `GitHub encountered the following error: ${error.message}`,
          };

          ipcRendererManager.send(
            IpcEvents.SHOW_WARNING_DIALOG,
            messageBoxOptions,
          );
        }
        this.setState({ isUpdating: false });
      } else {
        this.setState({ isDeleting: true });
        try {
          const gist = await octo.gists.delete({
            gist_id: appState.gistId!,
          });

          console.log('Deleting: Deleting done', { gist });
          this.renderToast({ message: 'Successfully deleted gist!' });
        } catch (error) {
          console.warn(`Could not delete gist`, { error });

          const messageBoxOptions: Electron.MessageBoxOptions = {
            message:
              'Deleting Fiddle Gist failed. Are you connected to the Internet and is this your Gist?',
            detail: `GitHub encountered the following error: ${error.message}`,
          };

          ipcRendererManager.send(
            IpcEvents.SHOW_WARNING_DIALOG,
            messageBoxOptions,
          );
        }

        appState.gistId = undefined;
        this.setState({ isDeleting: false });
        this.setActionType(GistActionType.publish);
      }
    } else {
      try {
        const gist = await octo.gists.create({
          public: !!gitHubPublishAsPublic,
          description: 'Electron Fiddle Gist',
          files: this.gistFilesList(values) as any, // Note: GitHub messed up, GistsCreateParamsFiles is an incorrect interface
        });

        appState.gistId = gist.data.id;
        appState.localPath = undefined;

        console.log(`Publish Button: Publishing complete`, { gist });
        this.renderToast({ message: 'Publishing completed successfully!' });
      } catch (error) {
        console.warn(`Could not publish gist`, { error });

        const messageBoxOptions: Electron.MessageBoxOptions = {
          message:
            'Publishing Fiddle to GitHub failed. Are you connected to the Internet?',
          detail: `GitHub encountered the following error: ${error.message}`,
        };

        ipcRendererManager.send(
          IpcEvents.SHOW_WARNING_DIALOG,
          messageBoxOptions,
        );
      }
    }

    appState.isPublishing = false;
    this.setActionType(GistActionType.update);
  }

  /**
   * Publish fiddles as private.
   *
   * @memberof GistActionButton
   */
  public setPrivate() {
    this.setPrivacy(false);
  }

  /**
   * Publish fiddles as public.
   *
   * @memberof GistActionButton
   */
  public setPublic() {
    this.setPrivacy(true);
  }

  public render() {
    const { isPublishing, gistId } = this.props.appState;
    const { isDeleting, isUpdating, actionType } = this.state;

    const getTextForButton = () => {
      let text;
      if (gistId) {
        if (actionType === GistActionType.delete) {
          text = 'Delete';
        } else {
          text = 'Update';
        }
      } else if (isUpdating) {
        text = 'Updating...';
      } else if (isPublishing) {
        text = 'Publishing...';
      } else if (isDeleting) {
        text = 'Deleting...';
      } else {
        text = 'Publish';
      }
      return text;
    };

    const getActionIcon = () => {
      switch (actionType) {
        case GistActionType.publish:
          return 'upload';
        case GistActionType.update:
          return 'refresh';
        case GistActionType.delete:
          return 'delete';
      }
    };

    return (
      <>
        <fieldset disabled={isPublishing}>
          <ButtonGroup className="button-gist-action">
            {this.renderPrivacyMenu()}
            <Button
              onClick={this.handleClick}
              loading={isPublishing}
              icon={getActionIcon()}
              text={getTextForButton()}
            />
            {this.renderGistActionMenu()}
          </ButtonGroup>
        </fieldset>
        <Toaster
          position={Position.BOTTOM_RIGHT}
          ref={this.refHandlers.toaster}
        />
      </>
    );
  }

  private renderGistActionMenu = () => {
    const { gistId } = this.props.appState;
    const { actionType } = this.state;

    if (!gistId) {
      return null;
    }

    const menu = (
      <Menu>
        <MenuItem
          text="Publish"
          active={actionType === GistActionType.publish}
          onClick={() => this.setActionType(GistActionType.publish)}
        />
        <MenuItem
          text="Update"
          active={actionType === GistActionType.update}
          onClick={() => this.setActionType(GistActionType.update)}
        />
        <MenuItem
          text="Delete"
          active={actionType === GistActionType.delete}
          onClick={() => this.setActionType(GistActionType.delete)}
        />
      </Menu>
    );

    return (
      <Popover content={menu} position={Position.BOTTOM}>
        <Button icon="wrench" />
      </Popover>
    );
  };

  private renderPrivacyMenu = () => {
    const { gitHubPublishAsPublic, gistId } = this.props.appState;

    if (gistId) {
      return null;
    }

    const privacyIcon = gitHubPublishAsPublic ? 'unlock' : 'lock';
    const privacyMenu = (
      <Menu>
        <MenuItem
          text="Private"
          icon="lock"
          active={!gitHubPublishAsPublic}
          onClick={this.setPrivate}
        />
        <MenuItem
          text="Public"
          icon="unlock"
          active={gitHubPublishAsPublic}
          onClick={this.setPublic}
        />
      </Menu>
    );

    return (
      <Popover content={privacyMenu} position={Position.BOTTOM}>
        <Button icon={privacyIcon} />
      </Popover>
    );
  };

  private setActionType = (actionType: GistActionType) => {
    this.setState({ actionType });
  };

  private setPrivacy(publishAsPublic: boolean) {
    this.props.appState.gitHubPublishAsPublic = publishAsPublic;
  }

  private renderToast = (toast: IToastProps) => {
    this.toaster.show(toast);
  };

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
  };
}
