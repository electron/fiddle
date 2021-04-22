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

import { MockState } from '../../mocks/state';

jest.mock('../../../src/utils/octokit');

describe('Action button component', () => {
  let state: MockState;
  const description = 'Electron Fiddle Gist';

  const expectedGistCreateOpts = {
    description,
    files: {
      [DefaultEditorId.html]: { content: 'html-content' },
      [DefaultEditorId.renderer]: { content: 'renderer-content' },
      [DefaultEditorId.main]: { content: 'main-content' },
      [DefaultEditorId.preload]: { content: 'preload-content' },
      [DefaultEditorId.css]: { content: 'css-content' },
    },
    public: true,
  };

  beforeEach(() => {
    ({ state } = (window as any).ElectronFiddle.app);
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
    const spyOn = jest.spyOn(ipcRendererManager, 'on');
    const spyOff = jest.spyOn(ipcRendererManager, 'off');

    const event = IpcEvents.FS_SAVE_FIDDLE_GIST;
    const { instance, wrapper } = createActionButton();
    expect(spyOn).toHaveBeenCalledWith(event, instance.handleClick);

    wrapper.unmount();
    expect(spyOff).toHaveBeenCalledWith(event, instance.handleClick);

    spyOn.mockRestore();
    spyOff.mockRestore();
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
    const gistId = '123';
    let mockOctokit: any;
    let instance: any;

    beforeEach(() => {
      mockOctokit = {
        authenticate: jest.fn(),
        gists: {
          create: jest.fn(async () => ({ data: { id: gistId } })),
        },
      };

      (getOctokit as any).mockImplementation(() => mockOctokit);

      ({ instance } = createActionButton());
    });

    it('publishes a gist', async () => {
      instance.getFiddleDescriptionFromUser = jest
        .fn()
        .mockReturnValue(description);

      await instance.performGistAction();
      expect(mockOctokit.gists.create).toHaveBeenCalledWith(
        expectedGistCreateOpts,
      );
    });

    function registerDialogHandler(
      description: string | null,
      result: boolean,
    ) {
      return reaction(
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
      const disposer = registerDialogHandler(description, true);
      await instance.performGistAction();
      expect(mockOctokit.gists.create).toHaveBeenCalledWith({
        ...expectedGistCreateOpts,
        description,
      });
      disposer();
    });

    it('provides a default description', async () => {
      const disposer = registerDialogHandler(null, true);
      await instance.performGistAction();
      expect(mockOctokit.gists.create).toHaveBeenCalledWith(
        expectedGistCreateOpts,
      );
      disposer();
    });

    it('publishes only if the user confirms', async () => {
      const disposer = registerDialogHandler(null, false);
      await instance.performGistAction();
      expect(mockOctokit.gists.create).not.toHaveBeenCalled();
      disposer();
    });

    it('handles missing content', async () => {
      const { instance } = createActionButton();
      instance.getFiddleDescriptionFromUser = jest
        .fn()
        .mockReturnValue(description);
      (window as any).ElectronFiddle.app.getEditorValues.mockReturnValueOnce(
        {},
      );

      await instance.performGistAction();

      expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
        ...expectedGistCreateOpts,
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
      mockOctokit.gists.create.mockImplementation(() => {
        throw new Error('💣');
      });

      const { instance } = createActionButton();
      instance.getFiddleDescriptionFromUser = jest
        .fn()
        .mockReturnValue(description);

      await instance.performGistAction();

      expect(state.activeGistAction).toBe(GistActionState.none);
    });
  });

  describe('update mode', () => {
    const gistId = '123';
    let mockOctokit: any;
    let wrapper: any;
    let instance: any;

    beforeEach(() => {
      mockOctokit = {
        authenticate: jest.fn(),
        gists: {
          update: jest.fn(),
        },
      };
      (getOctokit as any).mockReturnValue(mockOctokit);

      state.gistId = gistId;
      ({ instance, wrapper } = createActionButton());
      wrapper.setProps({ appState: state });
      instance.setState({ actionType: GistActionType.update });
    });

    it('attempts to update an existing Gist', async () => {
      await instance.performGistAction();

      expect(mockOctokit.gists.update).toHaveBeenCalledWith({
        gist_id: gistId,
        files: expectedGistCreateOpts.files,
      });
    });

    it('notifies the user if updating fails', async () => {
      const errorMessage = '💀';
      ipcRendererManager.send = jest.fn();
      mockOctokit.gists.update.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await instance.performGistAction();

      expect(ipcRendererManager.send).toHaveBeenCalledWith<any>(
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
    let mockOctokit: any;
    let wrapper: any;
    let instance: any;

    beforeEach(() => {
      mockOctokit = {
        authenticate: jest.fn(),
        gists: {
          delete: jest.fn(),
        },
      };

      (getOctokit as any).mockReturnValue(mockOctokit);

      ({ instance, wrapper } = createActionButton());
      wrapper.setProps({ appState: { gistId } });
      instance.setState({ actionType: GistActionType.delete });
    });

    it('attempts to delete an existing Gist', async () => {
      await instance.performGistAction();

      expect(mockOctokit.gists.delete).toHaveBeenCalledWith({
        gist_id: gistId,
      });
    });

    it('notifies the user if deleting fails', async () => {
      const errorMessage = '🔥';
      ipcRendererManager.send = jest.fn();
      mockOctokit.gists.delete.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await instance.performGistAction();

      expect(ipcRendererManager.send).toHaveBeenCalledWith<any>(
        IpcEvents.SHOW_WARNING_DIALOG,
        expect.objectContaining({
          detail: expect.stringContaining(errorMessage),
          message: expect.stringContaining('Deleting Fiddle Gist failed.'),
        }),
      );
    });
  });

  it('uses the privacy setting correctly', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(() => {
          throw new Error('bwap bwap');
        }),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const { instance } = createActionButton();
    instance.getFiddleDescriptionFromUser = jest
      .fn()
      .mockReturnValue(description);

    instance.setPrivate();
    await instance.performGistAction();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
      ...expectedGistCreateOpts,
      public: false,
    });

    instance.setPublic();
    await instance.performGistAction();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
      ...expectedGistCreateOpts,
      public: true,
    });
  });

  describe('disables itself', () => {
    async function testDisabledWhen(gistActionState: GistActionState) {
      state.activeGistAction = GistActionState.none;
      const { instance, wrapper } = createActionButton();
      expect(wrapper.find('fieldset').prop('disabled')).toBe(false);

      instance.performGistAction = jest.fn().mockImplementationOnce(() => {
        return new Promise<void>((resolve) => {
          wrapper.setProps(
            { appState: { state, activeGistAction: gistActionState } },
            () => expect(wrapper.find('fieldset').prop('disabled')).toBe(true),
          );
          wrapper.setProps(
            { appState: { state, activeGistAction: GistActionState.none } },
            () => expect(wrapper.find('fieldset').prop('disabled')).toBe(false),
          );
          resolve();
        });
      });

      await instance.performGistAction();
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
