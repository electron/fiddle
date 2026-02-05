import * as React from 'react';

import { Button } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { GistHistoryDialog } from './history';
import { AppState } from '../state';

interface HistoryWrapperProps {
  appState: AppState;
  buttonOnly?: boolean;
  className?: string;
}

/**
 * A component that observes the appState and manages the history dialog.
 * Can be rendered as just a button or as a button with a dialog.
 */
@observer
export class HistoryWrapper extends React.Component<HistoryWrapperProps> {
  private toggleHistory = () => {
    const { appState } = this.props;
    appState.toggleHistory();
  };

  private handleRevisionSelect = async (revisionId: string) => {
    const { remoteLoader } = window.app;
    try {
      await remoteLoader.fetchGistAndLoad(
        this.props.appState.gistId!,
        revisionId,
      );
    } catch (error: any) {
      console.error('Failed to load revision', error);
      this.props.appState.showErrorDialog(
        `Failed to load revision: ${error.message || 'Unknown error'}`,
      );
    }
  };

  public renderHistoryButton() {
    const { className } = this.props;

    return (
      <Button
        icon="history"
        onClick={this.toggleHistory}
        className={className}
        aria-label="View revision history"
        data-testid="history-button"
      />
    );
  }

  public render() {
    const { appState, buttonOnly } = this.props;
    const dialogKey = 'history-dialog';

    return (
      <>
        {buttonOnly ? (
          this.renderHistoryButton()
        ) : (
          <>
            {this.renderHistoryButton()}
            <GistHistoryDialog
              key={dialogKey}
              appState={appState}
              isOpen={appState.isHistoryShowing}
              onClose={this.toggleHistory}
              onRevisionSelect={this.handleRevisionSelect}
              activeRevision={appState.activeGistRevision}
            />
          </>
        )}
      </>
    );
  }
}
