import * as React from 'react';

import {
  Button,
  ButtonGroup,
  IToastProps,
  Menu,
  MenuItem,
  Position,
  Toaster,
} from '@blueprintjs/core';
import { Popover2 } from '@blueprintjs/popover2';
import { when } from 'mobx';
import { observer } from 'mobx-react';

import {
  EditorId,
  EditorValues,
  GistActionState,
  GistActionType,
  PACKAGE_NAME,
} from '../../interfaces';
import { AppState } from '../state';
import { ensureRequiredFiles } from '../utils/editor-utils';
import { getOctokit } from '../utils/octokit';

interface GistActionButtonProps {
  appState: AppState;
}

interface IGistActionButtonState {
  readonly isUpdating: boolean;
  readonly isDeleting: boolean;
  readonly actionType: GistActionType;
}

/**
 * The "publish" button takes care of logging you in.
 */
export const GistActionButton = observer(
  class GistActionButton extends React.Component<
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

      window.ElectronFiddle.removeAllListeners('save-fiddle-gist');
    }

    private toaster: Toaster;
    private refHandlers = {
      toaster: (ref: Toaster) => (this.toaster = ref),
    };

    public componentDidMount() {
      window.ElectronFiddle.addEventListener(
        'save-fiddle-gist',
        this.handleClick,
      );
    }

    public componentWillUnmount() {
      window.ElectronFiddle.removeAllListeners('save-fiddle-gist');
    }

    /**
     * When the user clicks the publish button, we either show the
     * authentication dialog or publish right away.
     *
     * If we're showing the authentication dialog, we wait for it
     * to be closed again (or a GitHub token to show up) before
     * we publish
     */
    public async handleClick(): Promise<void> {
      const { appState } = this.props;

      if (!appState.gitHubToken) {
        appState.toggleAuthDialog();
      }

      // Wait for the dialog to be closed again
      await when(() => !appState.isTokenDialogShowing);

      if (appState.gitHubToken) {
        return this.performGistAction();
      }
    }

    private getFiddleDescriptionFromUser(): Promise<string | undefined> {
      const placeholder = 'Electron Fiddle Gist' as const;
      return this.props.appState.showInputDialog({
        defaultInput: placeholder,
        label: 'Please provide a brief description for your Fiddle Gist',
        ok: 'Publish',
        placeholder,
      });
    }

    private async publishGist(description: string): Promise<boolean> {
      const { appState } = this.props;

      const octo = await getOctokit(appState);
      const { gitHubPublishAsPublic } = appState;
      const options = { includeDependencies: true, includeElectron: true };
      const defaultGistValues = await window.ElectronFiddle.getTemplate(
        appState.version,
      );
      const currentEditorValues = await window.app.getEditorValues(options);

      defaultGistValues[PACKAGE_NAME as EditorId] =
        currentEditorValues[PACKAGE_NAME as EditorId];

      try {
        const gistFilesList = appState.isPublishingGistAsRevision
          ? this.gistFilesList(defaultGistValues)
          : this.gistFilesList(currentEditorValues);

        const gist = await octo.gists.create({
          public: !!gitHubPublishAsPublic,
          description,
          files: gistFilesList,
        });

        appState.gistId = gist.data.id;
        appState.localPath = undefined;

        if (appState.isPublishingGistAsRevision) {
          await this.handleUpdate(appState.isPublishingGistAsRevision);
        }

        console.log(`Publish Button: Publishing complete`, { gist });
        this.renderToast({
          message: 'Successfully published gist!',
          action: {
            text: 'Copy link',
            icon: 'clipboard',
            onClick: () => navigator.clipboard.writeText(gist.data.html_url),
          },
        });

        // Only set action type to update if publish completed successfully.
        this.setActionType(GistActionType.update);

        return true;
      } catch (error) {
        console.warn(`Could not publish gist`, { error });

        window.ElectronFiddle.showWarningDialog({
          message:
            'Publishing Fiddle to GitHub failed. Are you connected to the Internet?',
          detail: `GitHub encountered the following error: ${error.message}`,
        });

        return false;
      }
    }

    /**
     * Publish a new GitHub gist.
     */
    public async handlePublish() {
      const { appState } = this.props;
      appState.activeGistAction = GistActionState.publishing;

      try {
        const description = await this.getFiddleDescriptionFromUser();

        if (description) {
          if (await this.publishGist(description)) {
            appState.editorMosaic.isEdited = false;
          }
        }
      } finally {
        appState.activeGistAction = GistActionState.none;
      }
    }

    /**
     * Update an existing GitHub gist.
     * silently updates the gist when publishing as a revision
     */
    public async handleUpdate(silent = false) {
      const { appState } = this.props;
      const octo = await getOctokit(this.props.appState);
      const options = { includeDependencies: true, includeElectron: true };
      const values = await window.app.getEditorValues(options);

      appState.activeGistAction = GistActionState.updating;

      try {
        const {
          data: { files: oldFiles },
        } = await octo.gists.get({ gist_id: appState.gistId! });

        const files = this.gistFilesList(values);
        for (const id of Object.keys(oldFiles)) {
          // Delete files that have been removed or renamed.
          if (!(id in files)) files[id] = null as any;
        }

        const gist = await octo.gists.update({
          gist_id: appState.gistId!,
          files,
        });

        appState.editorMosaic.isEdited = false;
        console.log('Updating: Updating done', { gist });

        if (!silent) {
          this.renderToast({
            message: 'Successfully updated gist!',
            action: {
              text: 'Copy link',
              icon: 'clipboard',
              onClick: () => navigator.clipboard.writeText(gist.data.html_url),
            },
          });
        }
      } catch (error) {
        console.warn(`Could not update gist`, { error });

        window.ElectronFiddle.showWarningDialog({
          message:
            'Updating Fiddle Gist failed. Are you connected to the Internet and is this your Gist?',
          detail: `GitHub encountered the following error: ${error.message}`,
          buttons: ['Ok'],
        });
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

        appState.editorMosaic.isEdited = true;
        console.log('Deleting: Deleting done', { gist });
        this.renderToast({ message: 'Successfully deleted gist!' });
      } catch (error) {
        console.warn(`Could not delete gist`, { error });

        window.ElectronFiddle.showWarningDialog({
          message:
            'Deleting Fiddle Gist failed. Are you connected to the Internet, is this your Gist, and have you loaded it?',
          detail: `GitHub encountered the following error: ${error.message}`,
        });
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

      const actionType = gistId
        ? this.state.actionType
        : GistActionType.publish;

      switch (actionType) {
        case GistActionType.delete:
          return this.handleDelete();

        case GistActionType.publish:
          return this.handlePublish();

        case GistActionType.update:
          return this.handleUpdate();
      }
    }

    /**
     * Publish fiddles as private.
     */
    public setPrivate() {
      this.setPrivacy(false);
    }

    /**
     * Publish fiddles as public.
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
                id="button-action"
                data-testid="button-action"
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
        <Popover2 content={menu} position={Position.BOTTOM}>
          <Button icon="wrench" />
        </Popover2>
      );
    };

    private renderPrivacyMenu = () => {
      const { gitHubPublishAsPublic, gistId } = this.props.appState;
      const { actionType } = this.state;

      if (gistId && actionType !== GistActionType.publish) {
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
        <Popover2 content={privacyMenu} position={Position.BOTTOM}>
          <Button icon={privacyIcon} />
        </Popover2>
      );
    };

    private setActionType = (actionType: GistActionType) => {
      this.setState({ actionType });
    };

    private setPrivacy(publishAsPublic: boolean) {
      this.props.appState.gitHubPublishAsPublic = publishAsPublic;
    }

    private renderToast = (toast: IToastProps) => {
      this.toaster?.show(toast);
    };

    private gistFilesList = (values: EditorValues) => {
      values = ensureRequiredFiles(values);
      return Object.fromEntries(
        Object.entries(values)
          .filter(([, content]) => Boolean(content))
          .map(([id, content]) => [id, { filename: id, content }]),
      );
    };
  },
);
