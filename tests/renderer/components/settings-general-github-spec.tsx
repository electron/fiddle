import * as React from 'react';

import { shallow } from 'enzyme';

import { GitHubSettings } from '../../../src/renderer/components/settings-general-github';
import { AppState } from '../../../src/renderer/state';

describe('GitHubSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders when not signed in', () => {
    const wrapper = shallow(<GitHubSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when signed in', () => {
    store.gitHubToken = '123';
    store.gitHubLogin = 'Test User';

    const wrapper = shallow(<GitHubSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('opens the token dialog on click', () => {
    const wrapper = shallow(<GitHubSettings appState={store} />);

    wrapper.childAt(1).childAt(1).simulate('click');
    expect(store.isTokenDialogShowing).toBe(true);
  });

  describe('Gist publish as revision component', () => {
    it('state changes', async () => {
      const wrapper = shallow(<GitHubSettings appState={store} />);
      const instance: any = wrapper.instance();

      instance.handlePublishGistAsRevisionChange({
        currentTarget: { checked: false },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isPublishingGistAsRevision).toBe(false);

      instance.handlePublishGistAsRevisionChange({
        currentTarget: { checked: true },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.isPublishingGistAsRevision).toBe(true);
    });
  });
});
