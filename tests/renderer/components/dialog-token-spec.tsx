import * as React from 'react';

import { Octokit } from '@octokit/rest';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
import { TokenDialog } from '../../../src/renderer/components/dialog-token';
import { AppState } from '../../../src/renderer/state';
import { getOctokit } from '../../../src/renderer/utils/octokit';
import { overrideRendererPlatform } from '../../utils';

vi.mock('../../../src/renderer/utils/octokit');

describe('TokenDialog component', () => {
  const mockValidToken = 'ghp_muuHkYenGrOHrTBQKDALW8WtSD929EXMz63n';
  const mockInvalidToken = 'testtoken';
  let store: AppState;

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
  });

  it('renders', () => {
    store.isTokenDialogShowing = true;
    render(<TokenDialog appState={store} />);

    expect(screen.getByText('GitHub Token')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(
      screen.getByText(/GitHub Personal Access Token/),
    ).toBeInTheDocument();
  });

  it('tries to read the clipboard on focus and enters it if valid', async () => {
    store.isTokenDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });

    vi.mocked(window.navigator.clipboard.readText).mockResolvedValueOnce(
      mockValidToken,
    );
    await act(async () => {
      await (instance as any).onTokenInputFocused();
    });

    expect(window.navigator.clipboard.readText).toHaveBeenCalled();
    expect((instance as any).state.tokenInput).toBe(mockValidToken);
  });

  it('tries to read the clipboard on focus and does not enter it if invalid', async () => {
    store.isTokenDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });

    vi.mocked(window.navigator.clipboard.readText).mockResolvedValueOnce(
      mockInvalidToken,
    );
    await act(async () => {
      await (instance as any).onTokenInputFocused();
    });

    expect(window.navigator.clipboard.readText).toHaveBeenCalled();
    expect((instance as any).state.tokenInput).toBe('');
  });

  it('reset() resets the component', () => {
    store.isTokenDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });

    act(() => {
      (instance as any).setState({
        verifying: true,
        tokenInput: 'hello',
        errorMessage: 'test error',
      });
    });
    act(() => {
      (instance as any).reset();
    });

    expect((instance as any).state).toEqual({
      verifying: false,
      error: false,
      errorMessage: undefined,
      tokenInput: '',
    });
  });

  it('onClose() resets the component', () => {
    store.isTokenDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });

    act(() => {
      (instance as any).setState({
        verifying: true,
        tokenInput: 'hello',
        errorMessage: 'test error',
      });
    });
    act(() => {
      (instance as any).onClose();
    });

    expect((instance as any).state).toEqual({
      verifying: false,
      error: false,
      errorMessage: undefined,
      tokenInput: '',
    });
  });

  it('handleChange() handles the change event', () => {
    store.isTokenDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });
    act(() => {
      (instance as any).setState({ verifying: true, tokenInput: 'hello' });
    });

    act(() => {
      (instance as any).handleChange({ target: { value: 'hi' } });
    });

    expect((instance as any).state.tokenInput).toBe('hi');
  });

  it('openGenerateTokenExternal() tries to open the link', () => {
    store.isTokenDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });

    act(() => {
      (instance as any).setState({ verifying: true, tokenInput: 'hello' });
    });
    (instance as any).openGenerateTokenExternal();

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
      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        (instance as any).setState({ tokenInput: '' });
      });

      await act(async () => {
        await (instance as any).onSubmitToken();
      });

      expect((instance as any).state.verifying).toBe(false);
    });

    it('tries to sign the user in', async () => {
      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        (instance as any).setState({ tokenInput: mockValidToken });
      });

      await act(async () => {
        await (instance as any).onSubmitToken();
      });

      expect(store.gitHubToken).toBe(mockValidToken);
      expect(store.gitHubLogin).toBe(mockUser.login);
      expect(store.gitHubName).toBe(mockUser.name);
      expect(store.gitHubAvatarUrl).toBe(mockUser.avatar_url);
      expect((instance as any).state.error).toBe(false);
      expect(store.isTokenDialogShowing).toBe(false);
    });

    it('handles an invalid token error', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockRejectedValue(
        new Error('Bad credentials'),
      );

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        (instance as any).setState({ tokenInput: mockValidToken });
      });

      await act(async () => {
        await (instance as any).onSubmitToken();
      });

      expect((instance as any).state.error).toBe(true);
      expect((instance as any).state.errorMessage).toBe(
        'Invalid GitHub token. Please check your token and try again.',
      );
      expect(store.gitHubToken).toEqual(null);
    });

    it('handles missing gist scope', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockResolvedValue({
        data: mockUser,
        headers: {
          'x-oauth-scopes': 'repo, user', // Missing 'gist' scope
        },
      } as any);

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        (instance as any).setState({ tokenInput: mockValidToken });
      });

      await act(async () => {
        await (instance as any).onSubmitToken();
      });

      expect((instance as any).state.error).toBe(true);
      expect((instance as any).state.errorMessage).toBe(
        'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
      );
      expect(store.gitHubToken).toEqual(null);
    });

    it('handles empty scopes header', async () => {
      vi.mocked(mockOctokit.users.getAuthenticated).mockResolvedValue({
        data: mockUser,
        headers: {
          // No x-oauth-scopes header
        },
      } as any);

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        (instance as any).setState({ tokenInput: mockValidToken });
      });

      await act(async () => {
        await (instance as any).onSubmitToken();
      });

      expect((instance as any).state.error).toBe(true);
      expect((instance as any).state.errorMessage).toBe(
        'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
      );
      expect(store.gitHubToken).toEqual(null);
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

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });

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

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });

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

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });

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

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });

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
