import * as electron from 'electron';
import { shallow } from 'enzyme';
import * as fs from 'fs-extra';
import * as React from 'react';

import { CreditsSettings } from '../../../src/renderer/components/settings-credits';

jest.mock('fs-extra', () => ({
  readJSON: jest.fn()
}));

jest.mock('../../../src/utils/import', () => ({
  fancyImport: async (p: string) => require(p)
}));

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

  let store: any;

  beforeEach(() => {
    store = {};
  });

  it('renders', async () => {
    (fs.readJSON as jest.Mock).mockImplementation(async () => {
      return mockContributors;
    });

    const wrapper = shallow(<CreditsSettings appState={store} />);
    const instance: CreditsSettings = wrapper.instance() as any;
    await instance.getContributors();

    expect(wrapper).toMatchSnapshot();
  });

  it('renders for contributors with less data', async () => {
    (fs.readJSON as jest.Mock).mockImplementation(async () => {
      return mockContributorsBroken;
    });

    const wrapper = shallow(<CreditsSettings appState={store} />);
    const instance: CreditsSettings = wrapper.instance() as any;
    await instance.getContributors();

    expect(wrapper).toMatchSnapshot();
  });

  it('renders nothing if we do not have contributors', async () => {
    (fs.readJSON as jest.Mock).mockImplementation(async () => {
      return [];
    });

    const wrapper = shallow(<CreditsSettings appState={store} />);
    const instance: CreditsSettings = wrapper.instance() as any;
    await instance.getContributors();

    expect(wrapper).toMatchSnapshot();
  });

  it('handles a read error', async () => {
    (fs.readJSON as jest.Mock).mockImplementation(async () => {
      throw new Error('Bwap-bwap');
    });

    const wrapper = shallow(<CreditsSettings appState={store} />);
    const instance: CreditsSettings = wrapper.instance() as any;
    await instance.getContributors();

    expect(wrapper).toMatchSnapshot();
  });

  it('handles a click', async () => {
    (fs.readJSON as jest.Mock).mockImplementation(async () => {
      return mockContributors;
    });

    const wrapper = shallow(<CreditsSettings appState={store} />);
    const instance: CreditsSettings = wrapper.instance() as any;
    await instance.getContributors();

    wrapper.find('.contributor').simulate('click');
    expect(electron.shell.openExternal).toHaveBeenCalled();
  });
});
