import { shallow } from 'enzyme';
import * as React from 'react';

import { Settings } from '../../../src/renderer/components/settings';

jest.mock('../../../src/renderer/components/settings-github', () => ({
  GitHubSettings: 'settings-github'
}));

jest.mock('../../../src/renderer/components/settings-electron', () => ({
  ElectronSettings: 'settings-electron'
}));

jest.mock('../../../src/renderer/components/settings-credits', () => ({
  CreditsSettings: 'settings-credits'
}));

describe('CreditsSettings component', () => {
  beforeEach(() => {
    this.store = {
      isSettingsShowing: true
    };
  });

  it('renders null if settings not showing', () => {
    this.store.isSettingsShowing = false;

    const wrapper = shallow(
      <Settings appState={this.store} />
    );

    expect(wrapper.html()).toBe(null);
  });

  it('renders only the menu if page unknown', () => {
    const wrapper = shallow(
      <Settings appState={this.store} />
    );

    wrapper.setState({ section: 'blub' });
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Electron page by default', () => {
    const wrapper = shallow(
      <Settings appState={this.store} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders the GitHub page after a click', () => {
    const wrapper = shallow(
      <Settings appState={this.store} />
    );

    wrapper.find('.GitHub').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the GitHub page after a click', () => {
    const wrapper = shallow(
      <Settings appState={this.store} />
    );

    wrapper.find('.Credits').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });
});
