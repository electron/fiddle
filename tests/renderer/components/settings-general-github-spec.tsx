import { shallow } from 'enzyme';
import * as React from 'react';

import { GitHubSettings } from '../../../src/renderer/components/settings-general-github';

describe('GitHubSettings component', () => {
  beforeEach(() => {
    this.store = {
      signOutGitHub: jest.fn()
    };
  });

  it('renders when not signed in', () => {
    const wrapper = shallow(
      <GitHubSettings appState={this.store} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when signed in', () => {
    this.store.gitHubToken = '123';
    this.store.gitHubLogin = 'Test User';

    const wrapper = shallow(
      <GitHubSettings appState={this.store} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click on the signout button', () => {
    this.store.gitHubToken = '123';
    this.store.gitHubLogin = 'Test User';

    const wrapper = shallow(
      <GitHubSettings appState={this.store} />
    );

    wrapper.find('button').simulate('click');
    expect(this.store.signOutGitHub).toHaveBeenCalled();
  });
});
