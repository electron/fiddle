import { shallow } from 'enzyme';
import * as React from 'react';

import { Settings } from '../../../src/renderer/components/settings';

jest.mock('../../../src/renderer/components/settings-general', () => ({
  GeneralSettings: 'settings-general'
}));

jest.mock('../../../src/renderer/components/settings-electron', () => ({
  ElectronSettings: 'settings-electron'
}));

jest.mock('../../../src/renderer/components/settings-credits', () => ({
  CreditsSettings: 'settings-credits'
}));

describe('Settings component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      isSettingsShowing: true
    };
  });

  it('renders null if settings not showing', () => {
    store.isSettingsShowing = false;

    const wrapper = shallow(
      <Settings appState={store} />
    );

    expect(wrapper.html()).toBe(null);
  });

  it('renders only the menu if page unknown', () => {
    const wrapper = shallow(
      <Settings appState={store} />
    );

    wrapper.setState({ section: 'blub' });
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Electron page by default', () => {
    const wrapper = shallow(
      <Settings appState={store} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders the General page after a click', () => {
    const wrapper = shallow(
      <Settings appState={store} />
    );

    wrapper.find('#settings-link-General').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Electron page after a click', () => {
    const wrapper = shallow(
      <Settings appState={store} />
    );

    wrapper.find('#settings-link-Electron').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Execution page after a click', () => {
    const wrapper = shallow(
      <Settings appState={store} />
    );

    wrapper.find('#settings-link-Execution').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Credits page after a click', () => {
    const wrapper = shallow(
      <Settings appState={store} />
    );

    wrapper.find('#settings-link-Credits').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('closes upon pressing Escape key', () => {
    expect(store.isSettingsShowing).toBe(true);
    // mock event listener API
    const map: any = {};
    window.addEventListener = jest.fn().mockImplementation((event, cb) => {
      map[event] = cb;
    });

    window.removeEventListener = jest.fn().mockImplementation((event) => {
      delete map[event];
    });

    const wrapper = shallow(
      <Settings appState={store} />
    );

    // trigger mock 'keyup' event
    map.keyup({code: 'Escape'});
    expect(Object.keys(map)).toHaveLength(1);
    expect(store.isSettingsShowing).toBe(false);

    // check if event listener is removed upon unmount
    wrapper.unmount();
    expect(Object.keys(map)).toHaveLength(0);
  });
});
