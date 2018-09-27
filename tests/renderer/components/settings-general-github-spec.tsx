import { shallow } from 'enzyme';
import * as React from 'react';

import { GitHubSettings } from '../../../src/renderer/components/settings-general-github';

describe('GitHubSettings component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      signOutGitHub: jest.fn()
    };
  });

  it('renders when not signed in', () => {
    const wrapper = shallow(
      <GitHubSettings appState={store} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when signed in', () => {
    store.gitHubToken = '123';
    store.gitHubLogin = 'Test User';

    const wrapper = shallow(
      <GitHubSettings appState={store} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click on the signout button', () => {
    store.gitHubToken = '123';
    store.gitHubLogin = 'Test User';

    const wrapper = shallow(
      <GitHubSettings appState={store} />
    );

    wrapper.find('button').simulate('click');
    expect(store.signOutGitHub).toHaveBeenCalled();
  });
});
