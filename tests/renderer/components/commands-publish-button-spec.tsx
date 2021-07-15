import * as React from 'react';
import { shallow } from 'enzyme';

import {
  DefaultEditorId,
  GistActionState,
  GistActionType,
  MAIN_JS,
} from '../../../src/interfaces';
import { IpcEvents } from '../../../src/ipc-events';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { GistActionButton } from '../../../src/renderer/components/commands-action-button';
import { getOctokit } from '../../../src/utils/octokit';
import { AppMock } from '../../mocks/app';
import { StateMock } from '../../mocks/mocks';

jest.mock('../../../src/utils/octokit');

class OctokitMock {
  private static nextId = 1;

  public authenticate = jest.fn();
  public gists = {
    create: jest.fn().mockImplementation(() => ({
      data: {
        id: OctokitMock.nextId++,
      },
    })),
    delete: jest.fn(),
    update: jest.fn(),
  };
}

describe('Action button component', () => {
  const description = 'Electron Fiddle Gist';
  const errorMessage = '💀';
  let app: AppMock;
  let mocktokit: OctokitMock;
  let state: StateMock;

  const gistCreateOpts = {
    description,
    files: {
      [DefaultEditorId.html]: { content: '<!-- index.html -->' },
      [DefaultEditorId.renderer]: { content: '// renderer.js' },
      [DefaultEditorId.main]: { content: '// main.js' },
      [DefaultEditorId.preload]: { content: '// preload.js' },
      [DefaultEditorId.css]: { content: '/* style.css */' },
    },
    public: true,
  } as const;

  beforeEach(() => {
    ({ app } = (window as any).ElectronFiddle);
    ({ state } = app);

    // have the octokit getter use our mock
    mocktokit = new OctokitMock();
    (getOctokit as any).mockImplementation(() => mocktokit);

    // listen for generated ipc traffic
    ipcRendererManager.send = jest.fn();
  });

  function createActionButton() {
    const wrapper = shallow(<GistActionButton appState={state as any} />);
    const instance = wrapper.instance() as any;
    return { wrapper, instance };
  }

  it('renders', () => {
    const { wrapper } = createActionButton();
    expect(wrapper).toMatchSnapshot();
  });

  it('registers for FS_SAVE_FIDDLE_GIST events', () => {
    const event = IpcEvents.FS_SAVE_FIDDLE_GIST;

    // confirm that it starts listening when mounted
    let spy = jest.spyOn(ipcRendererManager, 'on');
    const { instance, wrapper } = createActionButton();
    expect(spy).toHaveBeenCalledWith(event, instance.handleClick);
    spy.mockRestore();

    // confirm that it stops listening when unmounted
    spy = jest.spyOn(ipcRendererManager, 'off');
    wrapper.unmount();
    expect(spy).toHaveBeenCalledWith(event, instance.handleClick);
    spy.mockRestore();
  });

  it('toggles the auth dialog on click if not authed', async () => {
    state.toggleAuthDialog = jest.fn();
    const { instance } = createActionButton();
    await instance.handleClick();
    expect(state.toggleAuthDialog).toHaveBeenCalled();
  });

  it('toggles the publish method on click if authed', async () => {
    state.gitHubToken = 'github-token';

    const { instance } = createActionButton();
    instance.performGistAction = jest.fn();
    await instance.handleClick();

    expect(instance.performGistAction).toHaveBeenCalled();
  });

  describe('publish mode', () => {
    let instance: any;

    beforeEach(() => {
      // create a button that's primed to publish a new gist
      ({ instance } = createActionButton());
    });

    it('publishes a gist', async () => {
      state.showInputDialog = jest.fn().mockResolvedValueOnce(description);
      await instance.performGistAction();
      expect(mocktokit.gists.create).toHaveBeenCalledWith(gistCreateOpts);
    });

    it('asks the user for a description', async () => {
      const description = 'some non-default description';
      state.showInputDialog = jest.fn().mockResolvedValueOnce(description);
      await instance.performGistAction();
      expect(mocktokit.gists.create).toHaveBeenCalledWith({
        ...gistCreateOpts,
        description,
      });
    });

    it('publishes only if the user confirms', async () => {
      state.showInputDialog = jest.fn().mockResolvedValueOnce(undefined);
      await instance.performGistAction();
      expect(mocktokit.gists.create).not.toHaveBeenCalled();
    });

    it.each([
      ['handles missing files', {}],
      ['handles empty files', { [MAIN_JS]: '' }],
    ])('%s', async (_, appEditorValues) => {
      app.getEditorValues.mockReturnValueOnce(appEditorValues);
      const { instance } = createActionButton();
      state.showInputDialog = jest.fn().mockResolvedValueOnce(description);

      await instance.performGistAction();

      expect(mocktokit.gists.create).toHaveBeenCalledWith({
        ...gistCreateOpts,
        files: {
          [DefaultEditorId.html]: { content: '<!-- Empty -->' },
          [DefaultEditorId.renderer]: { content: '// Empty' },
          [DefaultEditorId.main]: { content: '// Empty' },
          [DefaultEditorId.preload]: { content: '// Empty' },
          [DefaultEditorId.css]: { content: '/* Empty */' },
        },
      });
    });

    it('handles an error in Gist publishing', async () => {
      mocktokit.gists.create.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      state.showInputDialog = jest.fn().mockResolvedValueOnce(description);

      const { instance } = createActionButton();
      await instance.performGistAction();
      expect(state.activeGistAction).toBe(GistActionState.none);
    });

    it('can publish private gists', async () => {
      state.showInputDialog = jest.fn().mockResolvedValueOnce(description);
      instance.setPrivate();
      await instance.performGistAction();
      const { create } = mocktokit.gists;
      expect(create).toHaveBeenCalledWith({ ...gistCreateOpts, public: false });
    });

    it('can publish public gists', async () => {
      state.showInputDialog = jest.fn().mockResolvedValueOnce(description);
      instance.setPublic();
      await instance.performGistAction();
      const { create } = mocktokit.gists;
      expect(create).toHaveBeenCalledWith({ ...gistCreateOpts, public: true });
    });
  });

  describe('update mode', () => {
    const gistId = '123';
    let wrapper: any;
    let instance: any;

    beforeEach(() => {
      // create a button that's primed to update gistId
      state.gistId = gistId;
      ({ instance, wrapper } = createActionButton());
      wrapper.setProps({ appState: state });
      instance.setState({ actionType: GistActionType.update });
    });

    it('attempts to update an existing Gist', async () => {
      await instance.performGistAction();

      expect(mocktokit.gists.update).toHaveBeenCalledWith({
        gist_id: gistId,
        files: gistCreateOpts.files,
      });
    });

    it('notifies the user if updating fails', async () => {
      mocktokit.gists.update.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await instance.performGistAction();

      expect(ipcRendererManager.send).toHaveBeenCalledWith(
        IpcEvents.SHOW_WARNING_DIALOG,
        expect.objectContaining({
          detail: expect.stringContaining(errorMessage),
          message: expect.stringContaining('Updating Fiddle Gist failed.'),
        }),
      );
    });
  });

  describe('delete mode', () => {
    const gistId = '123';
    let wrapper: any;
    let instance: any;

    beforeEach(() => {
      state.gistId = gistId;

      // create a button primed to delete gistId
      ({ instance, wrapper } = createActionButton());
      wrapper.setProps({ appState: state });
      instance.setState({ actionType: GistActionType.delete });
    });

    it('attempts to delete an existing Gist', async () => {
      await instance.performGistAction();
      expect(mocktokit.gists.delete).toHaveBeenCalledWith({ gist_id: gistId });
    });

    it('notifies the user if deleting fails', async () => {
      mocktokit.gists.delete.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await instance.performGistAction();

      expect(ipcRendererManager.send).toHaveBeenCalledWith(
        IpcEvents.SHOW_WARNING_DIALOG,
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
      const { wrapper } = createActionButton();
      expect(wrapper.find('fieldset').prop('disabled')).toBe(false);

      state.activeGistAction = gistActionState;
      expect(wrapper.find('fieldset').prop('disabled')).toBe(true);

      state.activeGistAction = GistActionState.none;
      expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
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

      instance.setPrivate();
      expect(state.gitHubPublishAsPublic).toBe(false);
    });
  });
});
