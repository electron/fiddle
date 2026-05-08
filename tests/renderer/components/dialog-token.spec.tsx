import * as React from 'react';

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenDialog } from '../../../src/renderer/components/dialog-token';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform } from '../../utils';
import { renderClassComponentWithInstanceRef } from '../utils/renderClassComponentWithInstanceRef';

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
      await instance.onTokenInputFocused();
    });

    expect(window.navigator.clipboard.readText).toHaveBeenCalled();
    expect(instance.state.tokenInput).toBe(mockValidToken);
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
      await instance.onTokenInputFocused();
    });

    expect(window.navigator.clipboard.readText).toHaveBeenCalled();
    expect(instance.state.tokenInput).toBe('');
  });

  it('reset() resets the component', () => {
    store.isTokenDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });

    act(() => {
      instance.setState({
        verifying: true,
        tokenInput: 'hello',
        errorMessage: 'test error',
      });
    });
    act(() => {
      instance.reset();
    });

    expect(instance.state).toEqual({
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
      instance.setState({
        verifying: true,
        tokenInput: 'hello',
        errorMessage: 'test error',
      });
    });
    act(() => {
      instance.onClose();
    });

    expect(instance.state).toEqual({
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
      instance.setState({ verifying: true, tokenInput: 'hello' });
    });

    act(() => {
      instance.handleChange({
        target: { value: 'hi' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(instance.state.tokenInput).toBe('hi');
  });

  it('openGenerateTokenExternal() tries to open the link', () => {
    store.isTokenDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });

    act(() => {
      instance.setState({ verifying: true, tokenInput: 'hello' });
    });
    instance.openGenerateTokenExternal();

    expect(window.open).toHaveBeenCalled();
  });

  describe('onSubmitToken()', () => {
    const mockLogin = 'test-login';

    beforeEach(() => {
      vi.mocked(window.ElectronFiddle.gitHubSignIn).mockResolvedValue({
        success: true,
        login: mockLogin,
      });
    });

    it('handles missing input', async () => {
      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        instance.setState({ tokenInput: '' });
      });

      await instance.onSubmitToken();

      expect(instance.state.verifying).toBe(false);
      expect(window.ElectronFiddle.gitHubSignIn).not.toHaveBeenCalled();
    });

    it('tries to sign the user in', async () => {
      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        instance.setState({ tokenInput: mockValidToken });
      });

      await instance.onSubmitToken();

      expect(window.ElectronFiddle.gitHubSignIn).toHaveBeenCalledWith(
        mockValidToken,
      );
      expect(store.gitHubLogin).toBe(mockLogin);
      expect(instance.state.error).toBe(false);
      expect(store.isTokenDialogShowing).toBe(false);
    });

    it('handles an invalid token error', async () => {
      vi.mocked(window.ElectronFiddle.gitHubSignIn).mockResolvedValueOnce({
        success: false,
        error: 'Invalid GitHub token. Please check your token and try again.',
      });

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        instance.setState({ tokenInput: mockValidToken });
      });

      await act(async () => {
        await instance.onSubmitToken();
      });

      expect(instance.state.error).toBe(true);
      expect(instance.state.errorMessage).toBe(
        'Invalid GitHub token. Please check your token and try again.',
      );
      expect(store.gitHubLogin).toEqual(null);
    });

    it('surfaces the missing-gist-scope error from the main process', async () => {
      vi.mocked(window.ElectronFiddle.gitHubSignIn).mockResolvedValueOnce({
        success: false,
        error:
          'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
      });

      store.isTokenDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(TokenDialog, {
        appState: store,
      });
      act(() => {
        instance.setState({ tokenInput: mockValidToken });
      });

      await act(async () => {
        await instance.onSubmitToken();
      });

      expect(instance.state.error).toBe(true);
      expect(instance.state.errorMessage).toBe(
        'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
      );
      expect(store.gitHubLogin).toEqual(null);
    });
  });
});
