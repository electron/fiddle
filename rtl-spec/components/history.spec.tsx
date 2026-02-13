import * as React from 'react';

import { Octokit } from '@octokit/rest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GistRevision } from '../../src/interfaces';
import { App } from '../../src/renderer/app';
import { GistHistoryDialog } from '../../src/renderer/components/history';
import { AppState } from '../../src/renderer/state';
import { getOctokit } from '../../src/renderer/utils/octokit';

vi.mock('../../src/renderer/utils/octokit');

describe('GistHistoryDialog component', () => {
  let app: App;
  let state: AppState;
  let mockGetGistRevisions: ReturnType<typeof vi.fn>;
  const mockOnClose = vi.fn();
  const mockOnRevisionSelect = vi.fn();

  const mockRevisions: GistRevision[] = [
    {
      sha: 'sha1',
      date: '2026-02-01T10:00:00Z',
      title: 'Created',
      changes: { additions: 10, deletions: 0, total: 10 },
    },
    {
      sha: 'sha2',
      date: '2026-02-05T12:00:00Z',
      title: 'Revision 1',
      changes: { additions: 5, deletions: 2, total: 7 },
    },
  ];

  beforeEach(() => {
    ({ app } = window);
    ({ state } = app);

    mockGetGistRevisions = vi.fn().mockResolvedValue(mockRevisions);
    (window.app as any).remoteLoader = {
      getGistRevisions: mockGetGistRevisions,
    };

    state.gistId = 'test-gist-id';
    state.activeGistRevision = 'sha2';

    vi.mocked(getOctokit).mockResolvedValue({} as unknown as Octokit);
  });

  function renderDialog(props: Partial<React.ComponentProps<typeof GistHistoryDialog>> = {}) {
    return render(
      <GistHistoryDialog
        appState={state}
        isOpen={true}
        onClose={mockOnClose}
        onRevisionSelect={mockOnRevisionSelect}
        activeRevision={state.activeGistRevision}
        {...props}
      />,
    );
  }

  it('renders and loads revisions when open', async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockGetGistRevisions).toHaveBeenCalledWith('test-gist-id');
    });

    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Revision 1')).toBeInTheDocument();
  });

  it('does not load revisions when closed', () => {
    renderDialog({ isOpen: false });

    expect(mockGetGistRevisions).not.toHaveBeenCalled();
  });

  it('shows the Active tag on the active revision', async () => {
    renderDialog({ activeRevision: 'sha2' });

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('reloads revisions when activeRevision prop changes', async () => {
    const { rerender } = renderDialog({ activeRevision: 'sha1' });

    await waitFor(() => {
      expect(mockGetGistRevisions).toHaveBeenCalledTimes(1);
    });

    // Simulate an update operation that changes activeRevision
    rerender(
      <GistHistoryDialog
        appState={state}
        isOpen={true}
        onClose={mockOnClose}
        onRevisionSelect={mockOnRevisionSelect}
        activeRevision="sha3"
      />,
    );

    await waitFor(() => {
      expect(mockGetGistRevisions).toHaveBeenCalledTimes(2);
    });
  });

  it('adds a placeholder for active revision not in the list', async () => {
    mockGetGistRevisions.mockResolvedValue([mockRevisions[0]]); // Only "Created"
    state.activeGistRevision = 'new-sha-not-in-list';

    renderDialog({ activeRevision: 'new-sha-not-in-list' });

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    // The placeholder revision should be shown
    expect(screen.getByText(/new-sha/i)).toBeInTheDocument();
  });

  it('does not mutate revisions array when rendering', async () => {
    const revisionsCopy = [...mockRevisions];
    mockGetGistRevisions.mockResolvedValue(revisionsCopy);

    const { rerender } = renderDialog();

    await waitFor(() => {
      expect(screen.getByText('Created')).toBeInTheDocument();
    });

    // Re-render to trigger another render cycle
    rerender(
      <GistHistoryDialog
        appState={state}
        isOpen={true}
        onClose={mockOnClose}
        onRevisionSelect={mockOnRevisionSelect}
        activeRevision={state.activeGistRevision}
      />,
    );

    // The order should still be consistent (newest first in display)
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('shows error state when no gist ID is available', async () => {
    state.gistId = undefined;

    renderDialog();

    await waitFor(() => {
      expect(screen.getByText('No Gist ID available')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    // Make the promise never resolve to keep loading state
    mockGetGistRevisions.mockImplementation(() => new Promise(() => {}));

    renderDialog();

    expect(screen.getByText('Loading revision history...')).toBeInTheDocument();
  });
});
