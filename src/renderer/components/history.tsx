import * as React from 'react';

import {
  Classes,
  Dialog,
  Icon,
  NonIdealState,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { AppState } from '../state';

interface GistRevision {
  sha: string;
  date: string;
  changes: {
    deletions: number;
    additions: number;
    total: number;
  };
}

interface HistoryProps {
  appState: AppState;
  isOpen: boolean;
  onClose: () => void;
  onRevisionSelect: (revisionId: string) => Promise<void>;
}

interface HistoryState {
  isLoading: boolean;
  revisions: GistRevision[];
  error: string | null;
}

@observer
export class GistHistoryDialog extends React.Component<
  HistoryProps,
  HistoryState
> {
  constructor(props: HistoryProps) {
    super(props);
    this.state = {
      isLoading: true,
      revisions: [],
      error: null,
    };
  }

  public async componentDidMount() {
    await this.loadRevisions();
  }

  private async loadRevisions() {
    const { appState } = this.props;
    const { remoteLoader } = window.app;

    if (!appState.gistId) {
      this.setState({ isLoading: false, error: 'No Gist ID available' });
      return;
    }

    this.setState({ isLoading: true, error: null });

    try {
      const revisions = await remoteLoader.getGistRevisions(appState.gistId);
      this.setState({ revisions, isLoading: false });
    } catch (error) {
      console.error('Failed to load gist revisions', error);
      this.setState({
        isLoading: false,
        error: 'Failed to load revision history',
      });
    }
  }

  private handleRevisionSelect = async (revision: GistRevision) => {
    try {
      await this.props.onRevisionSelect(revision.sha);
      this.props.onClose();
    } catch (error: any) {
      console.error('Failed to load revision', error);
      // show an error  to the user and hide popover

      this.props.appState.showErrorDialog(
        `Failed to load revision: ${error.message || 'Unknown error'}`,
      );
      this.props.onClose();
    }
  };

  private renderChangeStats(changes: GistRevision['changes']) {
    return (
      <div className="revision-changes">
        <Tag intent="success" minimal>
          +{changes.additions}
        </Tag>
        <Tag intent="danger" minimal>
          -{changes.deletions}
        </Tag>
        <Tag minimal>{changes.total} total</Tag>
      </div>
    );
  }

  private renderRevisionItem = (revision: GistRevision, index: number) => {
    const date = new Date(revision.date).toLocaleString();
    const shortSha = revision.sha.substring(0, 7);
    const titleLabel = index === 0 ? 'Created' : `Revision ${index}`;

    return (
      <li
        key={revision.sha}
        className="revision-item"
        onClick={() => this.handleRevisionSelect(revision)}
      >
        <div className="revision-content">
          <h4>
            <Icon icon="history" className="revision-icon" />
            {titleLabel}
            <span className="sha-label">{shortSha}</span>
          </h4>
          <div className="revision-details">
            <span className="revision-date">{date}</span>
            {this.renderChangeStats(revision.changes)}
          </div>
        </div>
      </li>
    );
  };

  private renderContent() {
    const { isLoading, revisions, error } = this.state;

    if (isLoading) {
      return (
        <div className="history-loading">
          <Spinner />
          <p>Loading revision history...</p>
        </div>
      );
    }

    if (error) {
      return (
        <NonIdealState
          icon="error"
          title="Error Loading History"
          description={error}
        />
      );
    }

    if (revisions.length === 0) {
      return (
        <NonIdealState
          icon="history"
          title="No Revision History"
          description="This Gist doesn't have any revisions"
        />
      );
    }

    return (
      <div className="revision-list">
        <ul>{revisions.map(this.renderRevisionItem)}</ul>
      </div>
    );
  }

  public render() {
    const { isOpen, onClose } = this.props;

    return (
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Revision History"
        className="gist-history-dialog"
        icon="history"
      >
        <div className={Classes.DIALOG_BODY}>{this.renderContent()}</div>
      </Dialog>
    );
  }
}
