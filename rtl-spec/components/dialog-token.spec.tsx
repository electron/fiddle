import { Octokit } from '@octokit/rest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenDialog } from '../../src/renderer/components/dialog-token';
import { AppState } from '../../src/renderer/state';
import { getOctokit } from '../../src/renderer/utils/octokit';
import { overrideRendererPlatform } from '../../tests/utils';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

vi.mock('../../src/renderer/utils/octokit');

describe('TokenDialog component', () => {
  const mockValidToken = 'ghp_muuHkYenGrOHrTBQKDALW8WtSD929EXMz63n';
  const mockInvalidToken = 'testtoken';
  let store: AppState;

  beforeEach(() => {
    overrideRendererPlatform('darwin');
    ({ state: store } = window.app);
    store.isTokenDialogShowing = true;
  });

  function renderTokenDialog() {
    return renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });
  }

  it('renders the dialog when open', () => {
    renderTokenDialog();

    expect(screen.getByText('GitHub Token')).toBeInTheDocument();
    expect(screen.getByText(/Generate a/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders Done and Cancel buttons', () => {
    renderTokenDialog();

    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('Done button is disabled when no token input', () => {
    renderTokenDialog();

    const doneButton = screen.getByRole('button', { name: /done/i });
    expect(doneButton).toBeDisabled();
  });

  it('Done button is enabled when token input exists', async () => {
    renderTokenDialog();

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'some-token');

    const doneButton = screen.getByRole('button', { name: /done/i });
    expect(doneButton).not.toBeDisabled();
  });

  it('tries to read the clipboard on focus and enters it if valid', async () => {
    const { instance } = renderTokenDialog();

    vi.mocked(window.navigator.clipboard.readText).mockResolvedValueOnce(
      mockValidToken,
    );

    await instance.onTokenInputFocused();

    expect(window.navigator.clipboard.readText).toHaveBeenCalled();
    expect(instance.state.tokenInput).toBe(mockValidToken);
  });

  it('tries to read the clipboard on focus and does not enter it if invalid', async () => {
    const { instance } = renderTokenDialog();

    vi.mocked(window.navigator.clipboard.readText).mockResolvedValueOnce(
      mockInvalidToken,
    );

    await instance.onTokenInputFocused();

    expect(window.navigator.clipboard.readText).toHaveBeenCalled();
    expect(instance.state.tokenInput).toBe('');
  });

  it('reset() resets the component', () => {
    const { instance } = renderTokenDialog();

    instance.setState({
      verifying: true,
      tokenInput: 'hello',
      errorMessage: 'test error',
    });

    instance.reset();

    expect(instance.state).toEqual({
      verifying: false,
      error: false,
      errorMessage: undefined,
      tokenInput: '',
    });
  });

  it('onClose() resets the component and hides dialog', () => {
    const { instance } = renderTokenDialog();

    instance.setState({
      verifying: true,
      tokenInput: 'hello',
      errorMessage: 'test error',
    });

    instance.onClose();

    expect(instance.state).toEqual({
      verifying: false,
      error: false,
      errorMessage: undefined,
      tokenInput: '',
    });
    expect(store.isTokenDialogShowing).toBe(false);
  });

  it('Cancel button closes dialog', () => {
    renderTokenDialog();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(store.isTokenDialogShowing).toBe(false);
  });

  it('handleChange() handles the change event', async () => {
    renderTokenDialog();

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hi');

    await waitFor(() => {
      expect(input).toHaveValue('hi');
    });
  });

  it('openGenerateTokenExternal() tries to open the link', () => {
    const { instance } = renderTokenDialog();

    instance.openGenerateTokenExternal();

    expect(window.open).toHaveBeenCalled();
  });

  it('clicking the generate token link opens external link', () => {
    renderTokenDialog();

    const link = screen.getByText('GitHub Personal Access Token');
    fireEvent.click(link);

    expect(window.open).toHaveBeenCalled();
  });

  describe('onSubmitToken()', () => {
    let mockOctokit: Octokit;
    const mockUser = {
      avatar_url: 'https://avatars.fake/hi',
      login: 'test-login',
      name: 'Test User',
    } as const;

    beforeEach(() => {
      mockOctokit = {
        authenticate: vi.fn(),
        users: {
          getAuthenticated: vi.fn().mockResolvedValue({
            data: mockUser,
            headers: {
              'x-oauth-scopes': 'gist, repo',
            },
          }),
        },
      } as unknown as Octokit;

      vi.mocked(getOctokit).mockResolvedValue(mockOctokit);
    });

    it('handles missing input', async () => {
      const { instance } = renderTokenDialog();
      instance.setState({ tokenInput: '' });

      await instance.onSubmitToken();

      expect(instance.state.verifying).toBe(false);
    });

    it('tries to sign the user in', async () => {
      const { instance } = renderTokenDialog();
      instance.setState({ tokenInput: mockValidToken });

      await instance.onSubmitToken();

      expect(store.gitHubToken).toBe(mockValidToken);
      expect(store.gitHubLogin).toBe(mockUser.login);
      expect(store.gitHubName).toBe(mockUser.name);
      expect(store.gitHubAvatarUrl).toBe(mockUser.avatar_url);
      expect(instance.state.error).toBe(false);
      expect(store.isTokenDialogShowing).toBe(false);
    });

    it('handles an invalid token error', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockRejectedValue(
        new Error('Bad credentials'),
      );

      const { instance } = renderTokenDialog();
      instance.setState({ tokenInput: mockValidToken });

      await instance.onSubmitToken();

      expect(instance.state.error).toBe(true);
      expect(instance.state.errorMessage).toBe(
        'Invalid GitHub token. Please check your token and try again.',
      );
      expect(store.gitHubToken).toEqual(null);
    });

    it('handles missing gist scope', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockResolvedValue({
        data: mockUser,
        headers: {
          'x-oauth-scopes': 'repo, user',
        },
      } as any);

      const { instance } = renderTokenDialog();
      instance.setState({ tokenInput: mockValidToken });

      await instance.onSubmitToken();

      expect(instance.state.error).toBe(true);
      expect(instance.state.errorMessage).toBe(
        'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
      );
      expect(store.gitHubToken).toEqual(null);
    });

    it('handles empty scopes header', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockResolvedValue({
        data: mockUser,
        headers: {},
      } as any);

      const { instance } = renderTokenDialog();
      instance.setState({ tokenInput: mockValidToken });

      await instance.onSubmitToken();

      expect(instance.state.error).toBe(true);
      expect(instance.state.errorMessage).toBe(
        'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
      );
      expect(store.gitHubToken).toEqual(null);
    });

    it('shows error callout when error occurs', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockRejectedValue(
        new Error('Bad credentials'),
      );

      const { instance } = renderTokenDialog();
      instance.setState({ tokenInput: mockValidToken });

      await instance.onSubmitToken();

      await waitFor(() => {
        expect(
          screen.getByText(
            'Invalid GitHub token. Please check your token and try again.',
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe('validateGitHubToken()', () => {
    let mockOctokit: Octokit;
    const mockUser = {
      avatar_url: 'https://avatars.fake/hi',
      login: 'test-login',
      name: 'Test User',
    } as const;

    beforeEach(() => {
      mockOctokit = {
        users: {
          getAuthenticated: vi.fn(),
        },
      } as unknown as Octokit;

      vi.mocked(getOctokit).mockResolvedValue(mockOctokit);
    });

    it('validates a token with gist scope', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockResolvedValue({
        data: mockUser,
        headers: {
          'x-oauth-scopes': 'gist, repo, user',
        },
      } as any);

      const { instance } = renderTokenDialog();

      const result = await (instance as any).validateGitHubToken('valid-token');

      expect(result).toEqual({
        isValid: true,
        scopes: ['gist', 'repo', 'user'],
        hasGistScope: true,
        user: mockUser,
      });
    });

    it('validates a token without gist scope', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockResolvedValue({
        data: mockUser,
        headers: {
          'x-oauth-scopes': 'repo, user',
        },
      } as any);

      const { instance } = renderTokenDialog();

      const result = await (instance as any).validateGitHubToken(
        'token-without-gist',
      );

      expect(result).toEqual({
        isValid: true,
        scopes: ['repo', 'user'],
        hasGistScope: false,
        user: mockUser,
      });
    });

    it('handles invalid token', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockRejectedValue(
        new Error('Bad credentials'),
      );

      const { instance } = renderTokenDialog();

      const result = await (instance as any).validateGitHubToken(
        'invalid-token',
      );

      expect(result).toEqual({
        isValid: false,
        scopes: [],
        hasGistScope: false,
        error: 'Bad credentials',
      });
    });

    it('handles missing scopes header', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockResolvedValue({
        data: mockUser,
        headers: {},
      } as any);

      const { instance } = renderTokenDialog();

      const result = await (instance as any).validateGitHubToken(
        'token-no-scopes-header',
      );

      expect(result).toEqual({
        isValid: true,
        scopes: [],
        hasGistScope: false,
        user: mockUser,
      });
    });
  });
});
