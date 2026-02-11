import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { GitHubSettings } from '../../../src/renderer/components/settings-general-github';
import { AppState } from '../../../src/renderer/state';

describe('GitHubSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders when not signed in', () => {
    render(<GitHubSettings appState={store} />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders when signed in', () => {
    store.gitHubToken = '123';
    store.gitHubLogin = 'Test User';

    render(<GitHubSettings appState={store} />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('opens the token dialog on click', async () => {
    const user = userEvent.setup();
    render(<GitHubSettings appState={store} />);

    await user.click(screen.getByText('Sign in'));
    expect(store.isTokenDialogShowing).toBe(true);
  });

  describe('Gist publish as revision component', () => {
    it('state changes', async () => {
      const user = userEvent.setup();
      store.isPublishingGistAsRevision = true;
      render(<GitHubSettings appState={store} />);

      const checkbox = screen.getByLabelText('Publish as revision.');

      // Uncheck: sets to false
      await user.click(checkbox);
      expect(store.isPublishingGistAsRevision).toBe(false);

      // Check again: sets to true
      await user.click(checkbox);
      expect(store.isPublishingGistAsRevision).toBe(true);
    });
  });
});
