import { shallow } from 'enzyme';
import * as React from 'react';

import { PublishButton } from '../../../src/renderer/components/publish-button';
import { getOctokit } from '../../../src/utils/octokit';

jest.mock('../../../src/utils/octokit');

describe('Publish button component', () => {
  let store: any;

  beforeEach(() => {
    store = {};
  });

  it('renders', () => {
    const wrapper = shallow(<PublishButton appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('toggles the auth dialog on click if not authed', () => {
    store.toggleAuthDialog = jest.fn();

    const wrapper = shallow(<PublishButton appState={store} />);
    wrapper.find('button').simulate('click');
    expect(store.toggleAuthDialog).toHaveBeenCalled();
  });

  it('toggles the publish method on click if authed', async () => {
    store.gitHubToken = 'github-token';

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;
    instance.publishFiddle = jest.fn();
    await instance.handleClick();

    expect(instance.publishFiddle).toHaveBeenCalled();
  });

  it('attempts to publish to Gist', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: '123' } }))
      }
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;

    await instance.publishFiddle();

    expect(mockOctokit.authenticate).toHaveBeenCalled();
    expect(mockOctokit.gists.create).toHaveBeenCalledWith({
      description: 'Electron Fiddle Gist',
      files: {
        'index.html': { content: 'html-content' },
        'renderer.js': { content: 'renderer-content' },
        'main.js': { content: 'main-content' },
      },
      public: true
    });
  });

  it('handles an error in Gist publishing', async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(() => {
          throw new Error('bwap bwap');
        })
      }
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;

    await instance.publishFiddle();

    expect(mockOctokit.authenticate).toHaveBeenCalled();
    expect(wrapper.state('isPublishing')).toBe(false);
  });
});
