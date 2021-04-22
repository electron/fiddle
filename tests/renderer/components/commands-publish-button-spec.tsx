import * as React from 'react';
import { reaction } from 'mobx';
import { shallow } from 'enzyme';

import {
  DefaultEditorId,
  GistActionState,
  GistActionType,
} from '../../../src/interfaces';
import { IpcEvents } from '../../../src/ipc-events';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { GistActionButton } from '../../../src/renderer/components/commands-action-button';
import { getOctokit } from '../../../src/utils/octokit';
import { AppMock } from '../../mocks/app';
import { MockState } from '../../mocks/state';

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

function mockImplementationThrows(mock: jest.Mock, message: string) {
  mock.mockImplementation(() => {
    throw new Error(message);
  });
}

describe('Action button component', () => {
  const description = 'Electron Fiddle Gist';
  const errorMessage = '💀';
  let state: MockState;
  let app: AppMock;
  let mocktokit: OctokitMock;

  const gistCreateOpts = {
    description,
    files: {
      [DefaultEditorId.html]: { content: 'html-content' },
      [DefaultEditorId.renderer]: { content: 'renderer-content' },
      [DefaultEditorId.main]: { content: 'main-content' },
      [DefaultEditorId.preload]: { content: 'preload-content' },
      [DefaultEditorId.css]: { content: 'css-content' },
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
    let dispose: any;

    beforeEach(() => {
      // create a button that's primed to publish a new gist
      ({ instance } = createActionButton());
    });

    afterEach(() => {
      if (dispose) dispose();
    });

    it('publishes a gist', async () => {
      instance.getFiddleDescriptionFromUser = jest
        .fn()
        .mockReturnValue(description);

      await instance.performGistAction();
      expect(mocktokit.gists.create).toHaveBeenCalledWith(gistCreateOpts);
    });

    function registerDialogHandler(
      description: string | null,
      result: boolean,
    ) {
      dispose = reaction(
        () => state.isGenericDialogShowing,
        () => {
          state.genericDialogLastInput = description;
          state.genericDialogLastResult = result;
          state.isGenericDialogShowing = false;
        },
      );
    }

    it('asks the user for a description', async () => {
      const description = 'some non-default description';
      registerDialogHandler(description, true);
      await instance.performGistAction();
      expect(mocktokit.gists.create).toHaveBeenCalledWith({
        ...gistCreateOpts,
        description,
      });
    });

    it('provides a default description', async () => {
      registerDialogHandler(null, true);
      await instance.performGistAction();
      expect(mocktokit.gists.create).toHaveBeenCalledWith(gistCreateOpts);
      dispose();
    });

    it('publishes only if the user confirms', async () => {
      registerDialogHandler(null, false);
      await instance.performGistAction();
      expect(mocktokit.gists.create).not.toHaveBeenCalled();
      dispose();
    });

    it('handles missing content', async () => {
      const { instance } = createActionButton();
      instance.getFiddleDescriptionFromUser = jest
        .fn()
        .mockReturnValue(description);
      app.getEditorValues.mockReturnValueOnce({});

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
      mockImplementationThrows(mocktokit.gists.create, errorMessage);

      const { instance } = createActionButton();
      instance.getFiddleDescriptionFromUser = jest
        .fn()
        .mockReturnValue(description);

      await instance.performGistAction();

      expect(state.activeGistAction).toBe(GistActionState.none);
    });

    it('can publish private gists', async () => {
      registerDialogHandler(description, true);
      instance.setPrivate();
      await instance.performGistAction();
      const { create } = mocktokit.gists;
      expect(create).toHaveBeenCalledWith({ ...gistCreateOpts, public: false });
    });

    it('can publish public gists', async () => {
      registerDialogHandler(description, true);
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
      mockImplementationThrows(mocktokit.gists.update, errorMessage);

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
      // create a button primed to delete gistId
      ({ instance, wrapper } = createActionButton());
      wrapper.setProps({ appState: { gistId } });
      instance.setState({ actionType: GistActionType.delete });
    });

    it('attempts to delete an existing Gist', async () => {
      await instance.performGistAction();
      expect(mocktokit.gists.delete).toHaveBeenCalledWith({ gist_id: gistId });
    });

    it('notifies the user if deleting fails', async () => {
      mockImplementationThrows(mocktokit.gists.delete, errorMessage);

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
