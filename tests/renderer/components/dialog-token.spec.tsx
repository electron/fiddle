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
  const resetState = {
    verifying: false,
    error: false,
    errorMessage: undefined,
    tokenInput: '',
  };
  let store: AppState;

  function renderDialog() {
    store.isTokenDialogShowing = true;
    return render(<TokenDialog appState={store} />);
  }

  function createDialog() {
    store.isTokenDialogShowing = true;
    return renderClassComponentWithInstanceRef(TokenDialog, {
      appState: store,
    });
  }

  type TokenDialogInstance = ReturnType<typeof createDialog>['instance'];

  function setDialogState(
    instance: TokenDialogInstance,
    nextState: Partial<TokenDialogInstance['state']>,
  ) {
    act(() => {
      instance.setState(nextState);
    });
  }

  function expectResetState(instance: TokenDialogInstance) {
    expect(instance.state).toEqual(resetState);
  }

  async function submitToken(
    instance: TokenDialogInstance,
    token = mockValidToken,
  ) {
    setDialogState(instance, { tokenInput: token });
    await act(async () => {
      await instance.onSubmitToken();
    });
  }

  async function expectSubmitError(errorMessage: string) {
    vi.mocked(window.ElectronFiddle.gitHubSignIn).mockResolvedValueOnce({
      success: false,
      error: errorMessage,
    });

    const { instance } = createDialog();
    await submitToken(instance);

    expect(instance.state.error).toBe(true);
    expect(instance.state.errorMessage).toBe(errorMessage);
    expect(store.gitHubLogin).toBeNull();
  }

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
  });

  it('renders', () => {
    renderDialog();

    expect(screen.getByText('GitHub Token')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(
      screen.getByText(/GitHub Personal Access Token/),
    ).toBeInTheDocument();
  });

  it('tries to read the clipboard on focus and enters it if valid', async () => {
    const { instance } = createDialog();

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
    const { instance } = createDialog();

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
    const { instance } = createDialog();
    setDialogState(instance, {
      verifying: true,
      tokenInput: 'hello',
      errorMessage: 'test error',
    });
    act(() => {
      instance.reset();
    });

    expectResetState(instance);
  });

  it('onClose() resets the component', () => {
    const { instance } = createDialog();
    setDialogState(instance, {
      verifying: true,
      tokenInput: 'hello',
      errorMessage: 'test error',
    });
    act(() => {
      instance.onClose();
    });

    expectResetState(instance);
  });

  it('handleChange() handles the change event', () => {
    const { instance } = createDialog();
    setDialogState(instance, { verifying: true, tokenInput: 'hello' });

    act(() => {
      instance.handleChange({
        target: { value: 'hi' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(instance.state.tokenInput).toBe('hi');
  });

  it('openGenerateTokenExternal() tries to open the link', () => {
    const { instance } = createDialog();
    setDialogState(instance, { verifying: true, tokenInput: 'hello' });
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
      const { instance } = createDialog();

      await instance.onSubmitToken();

      expect(instance.state.verifying).toBe(false);
      expect(window.ElectronFiddle.gitHubSignIn).not.toHaveBeenCalled();
    });

    it('tries to sign the user in', async () => {
      const { instance } = createDialog();
      await submitToken(instance);

      expect(window.ElectronFiddle.gitHubSignIn).toHaveBeenCalledWith(
        mockValidToken,
      );
      expect(store.gitHubLogin).toBe(mockLogin);
      expect(instance.state.error).toBe(false);
      expect(store.isTokenDialogShowing).toBe(false);
    });

    it('handles an invalid token error', async () => {
      await expectSubmitError(
        'Invalid GitHub token. Please check your token and try again.',
      );
    });

    it('surfaces the missing-gist-scope error from the main process', async () => {
      await expectSubmitError(
        'Token is missing the "gist" scope. Please generate a new token with gist permissions.',
      );
    });
  });
});
