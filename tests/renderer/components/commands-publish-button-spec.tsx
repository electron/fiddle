import * as React from 'react';
import { shallow } from 'enzyme';
import {
  EditorValues,
  GistActionState,
  GistActionType,
  MAIN_JS,
} from '../../../src/interfaces';
import { EditorMosaicMock } from '../../mocks/editor-mosaic';
import { GistActionButton } from '../../../src/renderer/components/commands-action-button';
import { createEditorValues } from '../../mocks/editor-values';
import { getEmptyContent } from '../../../src/utils/editor-utils';
import { getOctokit } from '../../../src/utils/octokit';

jest.mock('../../../src/utils/octokit');

describe('Publish button component', () => {
  let editorMosaic: EditorMosaicMock;
  let expectedGistCreateOpts: any;
  let store: any;
  let editorValues: EditorValues;

  beforeEach(() => {
    editorMosaic = new EditorMosaicMock();
    store = {
      gitHubPublishAsPublic: true,
    };

    editorValues = createEditorValues();

    const files = {};
    for (const [filename, content] of Object.entries(editorValues)) {
      files[filename] = { content };
    }

    expectedGistCreateOpts = {
      description: 'Electron Fiddle Gist',
      files,
      public: true,
    };
  });

  function createActionButton() {
    const wrapper = shallow(
      <GistActionButton appState={store} editorMosaic={editorMosaic as any} />,
    );
    const instance = wrapper.instance() as any;
    return { wrapper, instance };
  }

  it('renders', () => {
    const { wrapper } = createActionButton();
    expect(wrapper).toMatchSnapshot();
  });

  it('toggles the auth dialog on click if not authed', async () => {
    store.toggleAuthDialog = jest.fn();

    const { instance } = createActionButton();
    await instance.handleClick();

    expect(store.toggleAuthDialog).toHaveBeenCalled();
  });

  it('toggles the publish method on click if authed', async () => {
    store.gitHubToken = 'github-token';

    const { instance } = createActionButton();
    instance.performGistAction = jest.fn();
    await instance.handleClick();

    expect(instance.performGistAction).toHaveBeenCalled();
  });

  it('attempts to publish to Gist', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: '123' } })),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const { instance } = createActionButton();

    instance.getFiddleDescriptionFromUser = jest
      .fn()
      .mockReturnValue('Electron Fiddle Gist');
    await instance.performGistAction();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
      description: 'Electron Fiddle Gist',
      files: expectedGistCreateOpts.files,
      public: true,
    });
  });

  it('can cancel publishing to Gist', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: '123' } })),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const { instance } = createActionButton();

    instance.getFiddleDescriptionFromUser = jest.fn().mockReturnValue(null);
    await instance.performGistAction();

    expect(mockOctokit.gists.create).not.toHaveBeenCalled();
  });

  it('attempts to update an existing Gist', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        update: jest.fn(),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const { instance, wrapper } = createActionButton();

    store.gistId = 123;
    wrapper.setProps({ appState: store });
    instance.setState({ actionType: GistActionType.update });

    await instance.performGistAction();

    expect(mockOctokit.gists.update).toHaveBeenCalledWith({
      gist_id: 123,
      files: expectedGistCreateOpts.files,
    });
  });

  it('attempts to delete an existing Gist', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        delete: jest.fn(),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const { instance, wrapper } = createActionButton();

    wrapper.setProps({ appState: { gistId: 123 } });
    instance.setState({ actionType: GistActionType.delete });

    await instance.performGistAction();

    expect(mockOctokit.gists.delete).toHaveBeenCalledWith({
      gist_id: 123,
    });
  });

  it('handles missing content', async () => {
    const description = 'Electron Fiddle Gist';
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: '123' } })),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const { instance } = createActionButton();

    instance.getFiddleDescriptionFromUser = jest
      .fn()
      .mockReturnValue(description);
    (window as any).ElectronFiddle.app.getEditorValues.mockReturnValueOnce({});

    await instance.performGistAction();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
      description,
      files: {
        [MAIN_JS]: { content: getEmptyContent(MAIN_JS) },
      },
      public: true,
    });
  });

  it('handles a custom description', async () => {
    const description = 'My Custom Description';
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: '123' } })),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const { instance } = createActionButton();

    instance.getFiddleDescriptionFromUser = jest
      .fn()
      .mockReturnValue(description);
    (window as any).ElectronFiddle.app.getEditorValues.mockReturnValueOnce({});

    await instance.performGistAction();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
      description,
      files: {
        [MAIN_JS]: { content: getEmptyContent(MAIN_JS) },
      },
      public: true,
    });
  });

  it('handles an error in Gist publishing', async () => {
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
      .mockReturnValue('Electron Fiddle Gist');

    await instance.performGistAction();

    expect(store.activeGistAction).toBe(GistActionState.none);
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
      .mockReturnValue('Electron Fiddle Gist');

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

  it('disables during gist publishing', async () => {
    store.activeGistAction = GistActionState.none;
    const { instance, wrapper } = createActionButton();

    expect(wrapper.find('fieldset').prop('disabled')).toBe(false);

    instance.performGistAction = jest.fn().mockImplementationOnce(() => {
      return new Promise<void>((resolve) => {
        wrapper.setProps(
          { appState: { store, activeGistAction: GistActionState.publishing } },
          () => {
            expect(wrapper.find('fieldset').prop('disabled')).toBe(true);
          },
        );
        wrapper.setProps(
          { appState: { store, activeGistAction: GistActionState.none } },
          () => {
            expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
          },
        );
        resolve();
      });
    });

    await instance.performGistAction();
  });

  it('disables during gist updating', async () => {
    store.activeGistAction = GistActionState.none;
    const { instance, wrapper } = createActionButton();

    expect(wrapper.find('fieldset').prop('disabled')).toBe(false);

    instance.performGistAction = jest.fn().mockImplementationOnce(() => {
      return new Promise<void>((resolve) => {
        wrapper.setProps(
          { appState: { store, activeGistAction: GistActionState.updating } },
          () => {
            expect(wrapper.find('fieldset').prop('disabled')).toBe(true);
          },
        );
        wrapper.setProps(
          { appState: { store, activeGistAction: GistActionState.none } },
          () => {
            expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
          },
        );
        resolve();
      });
    });

    await instance.performGistAction();
  });

  it('disables during gist deleting', async () => {
    store.activeGistAction = GistActionState.none;
    const { instance, wrapper } = createActionButton();

    expect(wrapper.find('fieldset').prop('disabled')).toBe(false);

    instance.performGistAction = jest.fn().mockImplementationOnce(() => {
      return new Promise<void>((resolve) => {
        wrapper.setProps(
          { appState: { store, activeGistAction: GistActionState.deleting } },
          () => {
            expect(wrapper.find('fieldset').prop('disabled')).toBe(true);
          },
        );
        wrapper.setProps(
          { appState: { store, activeGistAction: GistActionState.none } },
          () => {
            expect(wrapper.find('fieldset').prop('disabled')).toBe(false);
          },
        );
        resolve();
      });
    });

    await instance.performGistAction();
  });

  describe('privacy menu', () => {
    it('toggles the privacy setting', () => {
      const { instance } = createActionButton();

      instance.setPublic();
      expect(store.gitHubPublishAsPublic).toBe(true);

      instance.setPrivate();
      expect(store.gitHubPublishAsPublic).toBe(false);
    });
  });
});
