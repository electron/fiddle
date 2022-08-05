import * as React from 'react';

import { observer } from 'mobx-react';

import { AppState } from '../state';
import { AddThemeDialog } from './dialog-add-theme';
import { AddVersionDialog } from './dialog-add-version';
import { BisectDialog } from './dialog-bisect';
import { GenericDialog } from './dialog-generic';
import { TokenDialog } from './dialog-token';
import { Settings } from './settings';

interface DialogsProps {
  appState: AppState;
}

/**
 * Dialogs (like the GitHub PAT input).
 *
 * @class Dialogs
 * @extends {React.Component<DialogsProps, {}>}
 */
export const Dialogs = observer(
  class Dialogs extends React.Component<DialogsProps> {
    public render() {
      const { appState } = this.props;
      const {
        isTokenDialogShowing,
        isSettingsShowing,
        isAddVersionDialogShowing,
        isThemeDialogShowing,
        isBisectDialogShowing,
        isGenericDialogShowing,
      } = appState;
      const maybeToken = isTokenDialogShowing ? (
        <TokenDialog key="dialogs" appState={appState} />
      ) : null;
      const maybeSettings = isSettingsShowing ? (
        <Settings key="settings" appState={appState} />
      ) : null;
      const maybeAddLocalVersion = isAddVersionDialogShowing ? (
        <AddVersionDialog key="add-version-dialog" appState={appState} />
      ) : null;
      const maybeMonaco = isThemeDialogShowing ? (
        <AddThemeDialog appState={appState} />
      ) : null;
      const maybeBisect = isBisectDialogShowing ? (
        <BisectDialog key="bisect-dialog" appState={appState} />
      ) : null;
      const genericDialog = isGenericDialogShowing ? (
        <GenericDialog appState={appState} />
      ) : null;

      return (
        <div key="dialogs" className="dialogs">
          {maybeToken}
          {maybeSettings}
          {maybeAddLocalVersion}
          {maybeMonaco}
          {maybeBisect}
          {genericDialog}
        </div>
      );
    }
  },
);
