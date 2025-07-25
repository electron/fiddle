import * as React from 'react';

import { shallow } from 'enzyme';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Settings } from '../../../src/renderer/components/settings';
import { AppState } from '../../../src/renderer/state';

vi.mock('../../../src/renderer/components/settings-general', () => ({
  GeneralSettings: 'settings-general',
}));

vi.mock('../../../src/renderer/components/settings-electron', () => ({
  ElectronSettings: 'settings-electron',
}));

vi.mock('../../../src/renderer/components/settings-credits', () => ({
  CreditsSettings: 'settings-credits',
}));

describe('Settings component', () => {
  let store: AppState;

  beforeEach(() => {
    store = {
      isSettingsShowing: true,
    } as AppState;
  });

  it('renders null if settings not showing', () => {
    store.isSettingsShowing = false;

    const wrapper = shallow(<Settings appState={store} />);

    expect(wrapper.html()).toBe(null);
  });

  it('renders only the menu if page unknown', () => {
    const wrapper = shallow(<Settings appState={store} />);

    wrapper.setState({ section: 'blub' });
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Electron page by default', () => {
    const wrapper = shallow(<Settings appState={store} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('renders the General page after a click', () => {
    const wrapper = shallow(<Settings appState={store} />);

    wrapper.find('#settings-link-General').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Electron page after a click', () => {
    const wrapper = shallow(<Settings appState={store} />);

    wrapper.find('#settings-link-Electron').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Execution page after a click', () => {
    const wrapper = shallow(<Settings appState={store} />);

    wrapper.find('#settings-link-Execution').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('renders the Credits page after a click', () => {
    const wrapper = shallow(<Settings appState={store} />);

    wrapper.find('#settings-link-Credits').simulate('click');
    expect(wrapper).toMatchSnapshot();
  });

  it('closes upon pressing Escape key', () => {
    expect(store.isSettingsShowing).toBe(true);
    // mock event listener API
    const map: any = {};
    window.addEventListener = vi.fn().mockImplementation((event, cb) => {
      map[event] = cb;
    });

    window.removeEventListener = vi.fn().mockImplementation((event) => {
      delete map[event];
    });

    const wrapper = shallow(<Settings appState={store} />);

    // trigger mock 'keyup' event
    map.keyup({ code: 'Escape' });
    expect(Object.keys(map)).toContain('keyup');
    expect(Object.keys(map)).toHaveLength(2); // ['keyup','contextmenu']
    expect(store.isSettingsShowing).toBe(false);

    // check if the event listeners are removed upon unmount
    wrapper.unmount();
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('makes sure the contextmenu is disabled', () => {
    expect(store.isSettingsShowing).toBe(true);
    // mock event listener API
    const map: any = {};
    window.addEventListener = vi.fn().mockImplementation((event, cb) => {
      map[event] = cb;
    });

    window.removeEventListener = vi.fn().mockImplementation((event) => {
      delete map[event];
    });

    const wrapper = shallow(<Settings appState={store} />);

    // trigger mock 'contextmenu' event
    const preventDefault = vi.fn();
    map.contextmenu({ preventDefault });
    expect(Object.keys(map)).toContain('contextmenu');
    expect(Object.keys(map)).toHaveLength(2); // ['keyup','contextmenu']
    expect(preventDefault).toHaveBeenCalledTimes(1);

    // check if the event listeners are removed upon unmount
    wrapper.unmount();
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('does not close when Escape key is pressed when theme selector is open', () => {
    expect(store.isSettingsShowing).toBe(true);
    // mock event listener API
    const map: any = {};
    window.addEventListener = vi.fn().mockImplementation((event, cb) => {
      map[event] = cb;
    });

    window.removeEventListener = vi.fn().mockImplementation((event) => {
      delete map[event];
    });

    // Set the theme selector showing to true
    const wrapper = shallow(<Settings appState={store} />);
    const instance: any = wrapper.instance();

    // Toggle the state of the variable
    instance.toggleHasPopoverOpen();

    // trigger mock 'keyup' event
    map.keyup({ code: 'Escape' });
    expect(Object.keys(map)).toHaveLength(2); // ['keyup','contextmenu']
    expect(store.isSettingsShowing).toBe(true);

    // Toggle the setting again as if it was closed
    instance.toggleHasPopoverOpen();

    // trigger mock 'keyup' event
    map.keyup({ code: 'Escape' });
    expect(Object.keys(map)).toHaveLength(2); // ['keyup','contextmenu']
    expect(store.isSettingsShowing).toBe(false);

    // check if the event listeners are removed upon unmount
    wrapper.unmount();
    expect(Object.keys(map)).toHaveLength(0);
  });
});
