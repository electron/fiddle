import * as React from 'react';

import * as electron from 'electron';
import { shallow } from 'enzyme';

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
      location: 'San Francisco',
    },
  ];

  const mockContributorsBroken = [
    {
      url: 'https://github.com/felixrieseberg',
      api: 'https://api.github.com/users/felixrieseberg',
      login: 'felixrieseberg',
      avatar: 'https://avatars3.githubusercontent.com/u/1426799?v=4',
      name: null,
      bio: null,
      location: null,
    },
  ];

  let store: any;

  beforeEach(() => {
    store = {};
  });

  it('renders', async () => {
    const wrapper = shallow(<CreditsSettings appState={store} />);
    wrapper.setState({ contributors: mockContributors });

    expect(wrapper).toMatchSnapshot();
  });

  it('renders for contributors with less data', async () => {
    const wrapper = shallow(<CreditsSettings appState={store} />);
    wrapper.setState({ contributors: mockContributorsBroken });

    expect(wrapper).toMatchSnapshot();
  });

  it('renders nothing if we do not have contributors', async () => {
    const wrapper = shallow(<CreditsSettings appState={store} />);
    wrapper.setState({ contributors: [] });

    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click', async () => {
    const wrapper = shallow(<CreditsSettings appState={store} />);
    wrapper.setState({ contributors: mockContributors });

    wrapper.find('.contributor').simulate('click');
    expect(electron.shell.openExternal).toHaveBeenCalled();
  });
});
