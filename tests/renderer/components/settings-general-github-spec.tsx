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

  it('opens the token dialog on click', () => {
    const wrapper = shallow(
      <GitHubSettings appState={store} />
    );

    wrapper.childAt(1).childAt(1).simulate('click');
    expect(store.isTokenDialogShowing).toBe(true);
  });
});
