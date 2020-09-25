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
import {
  EditorValues,
  GenericDialogType,
  GistActionState,
  GistActionType,
} from '../../interfaces';
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

  public async getFiddleDescriptionFromUser(): Promise<string> {
    const { appState } = this.props;

    // Reset potentially non-null last description.
    appState.genericDialogLastInput = null;

    appState.setGenericDialogOptions({
      type: GenericDialogType.confirm,
      label: 'Please provide a brief description for your Fiddle Gist',
      cancel: 'Skip',
      wantsInput: true,
      placeholder: 'Electron Fiddle Gist',
    });

    appState.isGenericDialogShowing = true;
    await when(() => !appState.isGenericDialogShowing);

    return appState.genericDialogLastInput ?? 'Electron Fiddle Gist';
  }

  /**
   * Publish a new GitHub gist.
   */
  public async handlePublish() {
    const { appState } = this.props;

    const octo = await getOctokit(this.props.appState);
    const { gitHubPublishAsPublic } = this.props.appState;
    const options = { includeDependencies: true, includeElectron: true };
    const values = await window.ElectronFiddle.app.getEditorValues(options);

    appState.activeGistAction = GistActionState.publishing;

    try {
      const description = await this.getFiddleDescriptionFromUser();

      const gist = await octo.gists.create({
        public: !!gitHubPublishAsPublic,
        description,
        files: this.gistFilesList(values) as any, // Note: GitHub messed up, GistsCreateParamsFiles is an incorrect interface
      });

      appState.gistId = gist.data.id;
      appState.localPath = undefined;

      console.log(`Publish Button: Publishing complete`, { gist });
      this.renderToast({ message: 'Publishing completed successfully!' });

      // Only set action type to update if publish completed successfully.
      this.setActionType(GistActionType.update);
    } catch (error) {
      console.warn(`Could not publish gist`, { error });

      const messageBoxOptions: Electron.MessageBoxOptions = {
        message:
          'Publishing Fiddle to GitHub failed. Are you connected to the Internet?',
        detail: `GitHub encountered the following error: ${error.message}`,
      };

      ipcRendererManager.send(IpcEvents.SHOW_WARNING_DIALOG, messageBoxOptions);
    }

    // Ensure any previous input is reset.
    appState.genericDialogLastInput = null;
    appState.activeGistAction = GistActionState.none;
  }

  /**
   * Update an existing GitHub gist.
   */
  public async handleUpdate() {
    const { appState } = this.props;
    const octo = await getOctokit(this.props.appState);
    const options = { includeDependencies: true, includeElectron: true };
    const values = await window.ElectronFiddle.app.getEditorValues(options);

    appState.activeGistAction = GistActionState.updating;

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

      ipcRendererManager.send(IpcEvents.SHOW_WARNING_DIALOG, messageBoxOptions);
    }

    appState.activeGistAction = GistActionState.none;
    this.setActionType(GistActionType.update);
  }

  /**
   * Delete an existing GitHub gist.
   */
  public async handleDelete() {
    const { appState } = this.props;
    const octo = await getOctokit(this.props.appState);

    appState.activeGistAction = GistActionState.deleting;

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
          'Deleting Fiddle Gist failed. Are you connected to the Internet, is this your Gist, and have you loaded it?',
        detail: `GitHub encountered the following error: ${error.message}`,
      };

      ipcRendererManager.send(IpcEvents.SHOW_WARNING_DIALOG, messageBoxOptions);
    }

    appState.gistId = undefined;
    appState.activeGistAction = GistActionState.none;
    this.setActionType(GistActionType.publish);
  }

  /**
   * Connect with GitHub, perform a publish/update/delete action,
   * and update all related properties in the app state.
   */
  public async performGistAction(): Promise<void> {
    const { gistId } = this.props.appState;
    const { actionType } = this.state;

    if (gistId) {
      switch (actionType) {
        case GistActionType.publish:
          await this.handlePublish();
          break;
        case GistActionType.update:
          await this.handleUpdate();
          break;
        case GistActionType.delete:
          await this.handleDelete();
          break;
      }
    } else {
      await this.handlePublish();
    }
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
    const { gistId, activeGistAction } = this.props.appState;
    const { actionType } = this.state;

    const getTextForButton = () => {
      let text;
      if (gistId) {
        text = actionType;
      } else if (activeGistAction === GistActionState.updating) {
        text = 'Updating...';
      } else if (activeGistAction === GistActionState.publishing) {
        text = 'Publishing...';
      } else if (activeGistAction === GistActionState.deleting) {
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

    const isPerformingAction = activeGistAction !== GistActionState.none;
    return (
      <>
        <fieldset disabled={isPerformingAction}>
          <ButtonGroup className="button-gist-action">
            {this.renderPrivacyMenu()}
            <Button
              onClick={this.handleClick}
              loading={isPerformingAction}
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
