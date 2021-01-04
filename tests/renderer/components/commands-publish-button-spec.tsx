import { shallow } from 'enzyme';
import * as React from 'react';
import { GistActionState, GistActionType } from '../../../src/interfaces';

import { GistActionButton } from '../../../src/renderer/components/commands-action-button';
import { getOctokit } from '../../../src/utils/octokit';

jest.mock('../../../src/utils/octokit');

describe('Publish button component', () => {
  let store: any;

  const expectedGistCreateOpts = {
    description: 'Electron Fiddle Gist',
    files: {
      'index.html': { content: 'html-content' },
      'renderer.js': { content: 'renderer-content' },
      'main.js': { content: 'main-content' },
      'preload.js': { content: 'preload-content' },
      'styles.css': { content: 'css-content' },
    },
    public: true,
  };

  beforeEach(() => {
    store = {
      gitHubPublishAsPublic: true,
    };
  });

  it('renders', () => {
    const wrapper = shallow(<GistActionButton appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('toggles the auth dialog on click if not authed', async () => {
    store.toggleAuthDialog = jest.fn();

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;
    await instance.handleClick();

    expect(store.toggleAuthDialog).toHaveBeenCalled();
  });

  it('toggles the publish method on click if authed', async () => {
    store.gitHubToken = 'github-token';

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;
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

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

    instance.getFiddleDescriptionFromUser = jest
      .fn()
      .mockReturnValue('Electron Fiddle Gist');
    await instance.performGistAction();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
      description: 'Electron Fiddle Gist',
      files: {
        'index.html': { content: 'html-content' },
        'renderer.js': { content: 'renderer-content' },
        'main.js': { content: 'main-content' },
        'preload.js': { content: 'preload-content' },
        'styles.css': { content: 'css-content' },
      },
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

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

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

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

    wrapper.setProps({ appState: { gistId: 123 } });
    instance.setState({ actionType: GistActionType.update });

    await instance.performGistAction();

    expect(mockOctokit.gists.update).toHaveBeenCalledWith({
      gist_id: 123,
      files: {
        'index.html': { content: 'html-content' },
        'renderer.js': { content: 'renderer-content' },
        'main.js': { content: 'main-content' },
        'preload.js': { content: 'preload-content' },
        'styles.css': { content: 'css-content' },
      },
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

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

    wrapper.setProps({ appState: { gistId: 123 } });
    instance.setState({ actionType: GistActionType.delete });

    await instance.performGistAction();

    expect(mockOctokit.gists.delete).toHaveBeenCalledWith({
      gist_id: 123,
    });
  });

  it('handles missing content', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: '123' } })),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

    instance.getFiddleDescriptionFromUser = jest
      .fn()
      .mockReturnValue('Electron Fiddle Gist');
    (window as any).ElectronFiddle.app.getEditorValues.mockReturnValueOnce({});

    await instance.performGistAction();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
      description: 'Electron Fiddle Gist',
      files: {
        'index.html': { content: '<!-- Empty -->' },
        'renderer.js': { content: '// Empty' },
        'main.js': { content: '// Empty' },
        'preload.js': { content: '// Empty' },
        'styles.css': { content: '/* Empty */' },
      },
      public: true,
    });
  });

  it('handles a custom description', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: '123' } })),
      },
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

    instance.getFiddleDescriptionFromUser = jest
      .fn()
      .mockReturnValue('My Custom Description');
    (window as any).ElectronFiddle.app.getEditorValues.mockReturnValueOnce({});

    await instance.performGistAction();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith<any>({
      description: 'My Custom Description',
      files: {
        'index.html': { content: '<!-- Empty -->' },
        'renderer.js': { content: '// Empty' },
        'main.js': { content: '// Empty' },
        'preload.js': { content: '// Empty' },
        'styles.css': { content: '/* Empty */' },
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

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;
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

    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

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
    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

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
    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

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
    const wrapper = shallow(<GistActionButton appState={store} />);
    const instance: GistActionButton = wrapper.instance() as any;

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
      const wrapper = shallow(<GistActionButton appState={store} />);
      const instance: GistActionButton = wrapper.instance() as any;

      instance.setPublic();
      expect(store.gitHubPublishAsPublic).toBe(true);

      instance.setPrivate();
      expect(store.gitHubPublishAsPublic).toBe(false);
    });
  });
});
