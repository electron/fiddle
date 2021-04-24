import { shallow } from 'enzyme';
import * as React from 'react';

import { StateMock } from '../../mocks/mocks';

import { GitHubSettings } from '../../../src/renderer/components/settings-general-github';

describe('GitHubSettings component', () => {
  let store: StateMock;

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  it('renders when not signed in', () => {
    const wrapper = shallow(<GitHubSettings appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when signed in', () => {
    store.gitHubToken = '123';
    store.gitHubLogin = 'Test User';

    const wrapper = shallow(<GitHubSettings appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('opens the token dialog on click', () => {
    const wrapper = shallow(<GitHubSettings appState={store as any} />);

    wrapper.childAt(1).childAt(1).simulate('click');
    expect(store.isTokenDialogShowing).toBe(true);
  });
});
