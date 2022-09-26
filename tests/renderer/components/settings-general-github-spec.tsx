import * as React from 'react';

import { shallow } from 'enzyme';

import { GitHubSettings } from '../../../src/renderer/components/settings-general-github';
import { StateMock } from '../../mocks/mocks';

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

  describe('Gist publish as revision component', () => {
    it('state changes', async () => {
      const wrapper = shallow(<GitHubSettings appState={store as any} />);
      const instance = wrapper.instance() as any;

      await instance.handlePublishGistAsRevisionChange({
        currentTarget: { checked: false },
      });

      expect(store.isPublishingGistAsRevision).toBe(false);

      await instance.handlePublishGistAsRevisionChange({
        currentTarget: { checked: true },
      });

      expect(store.isPublishingGistAsRevision).toBe(true);
    });
  });
});
