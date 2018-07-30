import * as React from 'react';
import { shallow } from 'enzyme';

import { PublishButton } from '../../../src/renderer/components/publish-button';
import { getOctokit } from '../../../src/utils/octokit';

jest.mock('../../../src/utils/octokit');
jest.mock('electron', () => require('../../mocks/electron'));

describe('Publish button component', () => {
  beforeEach(() => {
    this.store = {};
  });

  it('renders', () => {
    const wrapper = shallow(<PublishButton appState={this.store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('toggles the auth dialog on click if not authed', () => {
    this.store.toggleAuthDialog = jest.fn();

    const wrapper = shallow(<PublishButton appState={this.store} />);
    wrapper.find('button').simulate('click');
    expect(this.store.toggleAuthDialog).toHaveBeenCalled();
  });

  it('toggles the publish method on click if authed', async () => {
    this.store.gitHubToken = 'github-token';

    const wrapper = shallow(<PublishButton appState={this.store} />);
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

    const wrapper = shallow(<PublishButton appState={this.store} />);
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

    const wrapper = shallow(<PublishButton appState={this.store} />);
    const instance: PublishButton = wrapper.instance() as any;

    await instance.publishFiddle();

    expect(mockOctokit.authenticate).toHaveBeenCalled();
    expect(wrapper.state('isPublishing')).toBe(false);
  });
});

