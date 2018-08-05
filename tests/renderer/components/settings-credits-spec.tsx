import * as electron from 'electron';
import { shallow } from 'enzyme';
import * as React from 'react';

import { CreditsSettings } from '../../../src/renderer/components/settings-credits';

describe('CreditsSettings component', () => {
  const mockContributors = [
    {
      url: 'https://github.com/felixrieseberg',
      api: 'https://api.github.com/users/felixrieseberg',
      login: 'felixrieseberg',
      avatar: 'https://avatars3.githubusercontent.com/u/1426799?v=4',
      name: 'Felix Rieseberg',
      bio: '🙇 ✨🌳 ',
      location: 'San Francisco'
    }
  ];

  const mockContributorsBroken = [
    {
      url: 'https://github.com/felixrieseberg',
      api: 'https://api.github.com/users/felixrieseberg',
      login: 'felixrieseberg',
      avatar: 'https://avatars3.githubusercontent.com/u/1426799?v=4',
      name: null,
      bio: null,
      location: null
    }
  ];

  beforeEach(() => {
    this.store = {};
  });

  it('renders', () => {
    const wrapper = shallow(
      <CreditsSettings appState={this.store} contributors={mockContributors} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders for contributors with less data', () => {
    const wrapper = shallow(
      <CreditsSettings appState={this.store} contributors={mockContributorsBroken} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders nothing if we do not have contributors', () => {
    const wrapper = shallow(
      <CreditsSettings appState={this.store} contributors={[]} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click', () => {
    const wrapper = shallow(
      <CreditsSettings appState={this.store} contributors={mockContributors} />
    );

    wrapper.find('.contributor').simulate('click');
    expect(electron.shell.openExternal).toHaveBeenCalled();
  });
});
