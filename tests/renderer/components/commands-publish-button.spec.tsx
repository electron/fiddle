import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EditorValues,
  GistActionState,
  GistActionType,
  GistCreateParams,
  GistFile,
  MAIN_JS,
} from '../../../src/interfaces';
import { App } from '../../../src/renderer/app';
import { GistActionButton } from '../../../src/renderer/components/commands-action-button';
import { AppState } from '../../../src/renderer/state';
import { createEditorValues } from '../../mocks/mocks';
import { renderClassComponentWithInstanceRef } from '../utils/renderClassComponentWithInstanceRef';

type GistFiles = { [id: string]: GistFile };

describe('Action button component', () => {
  const description = 'Electron Fiddle Gist';
  const errorMessage = '💀';
  let app: App;
  let state: AppState;
  let expectedGistOpts: GistCreateParams;

  function getGistFiles(values: EditorValues): GistFiles {
    return Object.fromEntries(
      Object.entries(values).map(([id, content]) => [
        id,
        { filename: id, content } as GistFile,
      ]),
    );
  }

  beforeEach(() => {
    ({ app } = window);
    ({ state } = app);

    // default IPC mock for gist create so publishGist() can run
    vi.mocked(window.ElectronFiddle.gistCreate).mockResolvedValue({
      id: 'created-gist-id',
      url: 'https://gist.github.com/created-gist-id',
      revision: 'created-sha',
    });

    // default IPC mock for gist updates so handleUpdate() can run safely
    vi.mocked(window.ElectronFiddle.gistUpdate).mockResolvedValue({
      id: 'gist-id',
      url: 'https://gist.github.com/gist-id',
      revision: 'updated-sha',
    });

    // build ExpectedGistCreateOpts
    const editorValues = createEditorValues();
    const files = getGistFiles(editorValues);
    expectedGistOpts = { description, files, isPublic: true };

    vi.mocked(window.ElectronFiddle.getTemplate).mockResolvedValue({
      [MAIN_JS]: '// content',
    });
  });

  function createActionButton() {
    return renderClassComponentWithInstanceRef(GistActionButton, {
      appState: state,
    });
  }

  it('renders', () => {
    const { renderResult } = createActionButton();
    const button = renderResult.getByTestId('button-action');
    expect(button).toBeInTheDocument();
  });

  it('registers for "save-fiddle-gist" events', () => {
    // confirm that it starts listening when mounted
    const listenSpy = vi.spyOn(window.ElectronFiddle, 'addEventListener');
    const {
      instance,
      renderResult: { unmount },
    } = createActionButton();
    expect(listenSpy).toHaveBeenCalledWith(
      'save-fiddle-gist',
      instance.handleClick,
    );
    listenSpy.mockRestore();

    // confirm that it stops listening when unmounted
    const removeListenerSpy = vi.spyOn(
      window.ElectronFiddle,
      'removeAllListeners',
    );
    unmount();
    expect(removeListenerSpy).toHaveBeenCalledWith('save-fiddle-gist');
    removeListenerSpy.mockRestore();
  });

  it('toggles the auth dialog on click if not authed', async () => {
    state.toggleAuthDialog = vi.fn();
    const { instance } = createActionButton();
    await instance.handleClick();
    expect(state.toggleAuthDialog).toHaveBeenCalled();
  });

  it('toggles the publish method on click only after authing if not authed', async () => {
    state.toggleAuthDialog = vi.fn();
    const { instance } = createActionButton();
    instance.performGistAction = vi.fn();

    // If not authed, don't continue to performGistAction
    await instance.handleClick();
    expect(state.toggleAuthDialog).toHaveBeenCalled();
    expect(instance.performGistAction).not.toHaveBeenCalled();

    // If authed, continue to performGistAction
    vi.mocked(state.toggleAuthDialog).mockImplementationOnce(
      () => (state.gitHubLogin = 'test-user'),
    );
    await instance.handleClick();
    expect(state.toggleAuthDialog).toHaveBeenCalled();
    expect(instance.performGistAction).toHaveBeenCalled();
  });

  it('toggles the publish method on click if authed', async () => {
    state.gitHubLogin = 'test-user';

    const { instance } = createActionButton();
    instance.performGistAction = vi.fn();
    await instance.handleClick();

    expect(instance.performGistAction).toHaveBeenCalled();
  });

  describe('publish mode', () => {
    let instance: InstanceType<typeof GistActionButton>;

    beforeEach(() => {
      // create a button that's primed to publish a new gist
      ({ instance } = createActionButton());
      state.isPublishingGistAsRevision = false;
    });

    it('publishes a gist', async () => {
      state.showInputDialog = vi.fn().mockResolvedValueOnce(description);
      await instance.performGistAction();
      expect(window.ElectronFiddle.gistCreate).toHaveBeenCalledWith(
        expectedGistOpts,
      );
    });

    it('marks the Fiddle as saved', async () => {
      (state.editorMosaic as any).currentHashes = new Map([
        [MAIN_JS, 'abc123'],
      ]);
      state.showInputDialog = vi.fn().mockResolvedValueOnce(description);
      await instance.performGistAction();
      expect(window.ElectronFiddle.gistCreate).toHaveBeenCalledWith(
        expectedGistOpts,
      );
      expect(state.editorMosaic.isEdited).toBe(false);
    });

    it('asks the user for a description', async () => {
      const description = 'some non-default description';
      state.showInputDialog = vi.fn().mockResolvedValueOnce(description);
      await instance.performGistAction();
      expect(window.ElectronFiddle.gistCreate).toHaveBeenCalledWith({
        ...expectedGistOpts,
        description,
      });
    });

    it('publishes only if the user confirms', async () => {
      state.showInputDialog = vi.fn().mockResolvedValueOnce(undefined);
      await instance.performGistAction();
      expect(window.ElectronFiddle.gistCreate).not.toHaveBeenCalled();
    });

    describe('empty files', () => {
      it('are replaced with default content for required files', async () => {
        const values = { [MAIN_JS]: '' } as const;

        vi.mocked(app.getEditorValues).mockResolvedValueOnce(values);
        state.showInputDialog = vi.fn().mockResolvedValueOnce(description);
        await instance.performGistAction();

        const files = getGistFiles(values);
        const expected = { ...expectedGistOpts, files };
        expect(window.ElectronFiddle.gistCreate).toHaveBeenCalledWith(expected);
      });

      it('are omitted if they are not required files', async () => {
        const required = { [MAIN_JS]: '// fnord' };
        const optional = { 'foo.js': '' };

        vi.mocked(app.getEditorValues).mockResolvedValueOnce({
          ...required,
          ...optional,
        });
        state.showInputDialog = vi.fn().mockResolvedValueOnce(description);
        await instance.performGistAction();

        const files = getGistFiles(required);
        const expected = { ...expectedGistOpts, files };
        expect(window.ElectronFiddle.gistCreate).toHaveBeenCalledWith(expected);
      });

      it('calls update() if isPublishingGistAsRevision is true', async () => {
        state.isPublishingGistAsRevision = true;
        state.showInputDialog = vi.fn().mockResolvedValueOnce(description);

        const spy = vi.spyOn(instance, 'handleUpdate');

        await instance.performGistAction();
        expect(spy).toHaveBeenCalledWith(true);
      });
    });

    it('handles an error in Gist publishing', async () => {
      vi.mocked(window.ElectronFiddle.gistCreate).mockRejectedValueOnce(
        new Error(errorMessage),
      );

      state.showInputDialog = vi.fn().mockResolvedValueOnce(description);

      await instance.performGistAction();
      expect(state.activeGistAction).toBe(GistActionState.none);

      // On failure the editor should still be considered edited
    });

    it('can publish secret gists', async () => {
      state.showInputDialog = vi.fn().mockResolvedValueOnce(description);
      instance.setSecret();
      await instance.performGistAction();
      expect(window.ElectronFiddle.gistCreate).toHaveBeenCalledWith({
        ...expectedGistOpts,
        isPublic: false,
      });
    });

    it('can publish public gists', async () => {
      state.showInputDialog = vi.fn().mockResolvedValueOnce(description);
      instance.setPublic();
      await instance.performGistAction();
      expect(window.ElectronFiddle.gistCreate).toHaveBeenCalledWith({
        ...expectedGistOpts,
        isPublic: true,
      });
    });

    it('sets activeGistRevision to the new revision SHA after publishing', async () => {
      const revisionSha = 'new-publish-revision-sha';
      vi.mocked(window.ElectronFiddle.gistCreate).mockResolvedValueOnce({
        id: 'new-gist-id',
        url: 'https://gist.github.com/new-gist-id',
        revision: revisionSha,
      });

      state.showInputDialog = vi.fn().mockResolvedValueOnce(description);
      await instance.performGistAction();

      expect(state.activeGistRevision).toBe(revisionSha);
    });
  });

  describe('update mode', () => {
    const gistId = '123';
    let instance: any;

    beforeEach(() => {
      // create a button that's primed to update gistId
      state.gistId = gistId;
      ({ instance } = createActionButton());
      act(() => instance.setState({ actionType: GistActionType.update }));

      vi.mocked(window.ElectronFiddle.gistUpdate).mockResolvedValue({
        id: gistId,
        url: `https://gist.github.com/${gistId}`,
        revision: 'updated-sha',
      });
    });

    it('attempts to update an existing Gist via IPC', async () => {
      await instance.performGistAction();

      expect(window.ElectronFiddle.gistUpdate).toHaveBeenCalledWith({
        gistId,
        files: expectedGistOpts.files,
      });
    });

    it('sets activeGistRevision to the new revision SHA after updating', async () => {
      const revisionSha = 'new-update-revision-sha';
      vi.mocked(window.ElectronFiddle.gistUpdate).mockResolvedValueOnce({
        id: gistId,
        url: `https://gist.github.com/${gistId}`,
        revision: revisionSha,
      });

      await instance.performGistAction();

      expect(state.activeGistRevision).toBe(revisionSha);
    });

    it('notifies the user if updating fails', async () => {
      vi.mocked(window.ElectronFiddle.gistUpdate).mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await instance.performGistAction();

      expect(window.ElectronFiddle.showWarningDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.stringContaining(errorMessage),
          message: expect.stringContaining('Updating Fiddle Gist failed.'),
        }),
      );
    });
  });

  describe('delete mode', () => {
    const gistId = '123';
    let instance: any;

    beforeEach(() => {
      state.gistId = gistId;

      // create a button primed to delete gistId
      ({ instance } = createActionButton());
      act(() => instance.setState({ actionType: GistActionType.delete }));
    });

    it('attempts to delete an existing Gist via IPC', async () => {
      await instance.performGistAction();
      expect(window.ElectronFiddle.gistDelete).toHaveBeenCalledWith(gistId);
    });

    it('notifies the user if deleting fails', async () => {
      vi.mocked(window.ElectronFiddle.gistDelete).mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await instance.performGistAction();

      expect(window.ElectronFiddle.showWarningDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.stringContaining(errorMessage),
          message: expect.stringContaining('Deleting Fiddle Gist failed.'),
        }),
      );
    });
  });

  describe('disables itself', () => {
    async function testDisabledWhen(gistActionState: GistActionState) {
      // create a button with no initial state
      state.activeGistAction = GistActionState.none;
      const {
        renderResult: { container },
      } = createActionButton();
      expect(container.querySelector('fieldset')).not.toBeDisabled();

      state.activeGistAction = gistActionState;
      await waitFor(() => {
        expect(container.querySelector('fieldset')).toBeDisabled();
      });

      state.activeGistAction = GistActionState.none;
      await waitFor(() => {
        expect(container.querySelector('fieldset')).not.toBeDisabled();
      });
    }

    it('while publishing', async () => {
      await testDisabledWhen(GistActionState.publishing);
    });
    it('while updating', async () => {
      await testDisabledWhen(GistActionState.updating);
    });
    it('while deleting', async () => {
      await testDisabledWhen(GistActionState.deleting);
    });
  });

  describe('privacy menu', () => {
    it('toggles the privacy setting', () => {
      const { instance } = createActionButton();

      instance.setPublic();
      expect(state.gitHubPublishAsPublic).toBe(true);

      instance.setSecret();
      expect(state.gitHubPublishAsPublic).toBe(false);
    });
  });
});
