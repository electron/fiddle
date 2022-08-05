import * as React from 'react';

import { Button, ControlGroup } from '@blueprintjs/core';
import { shallow } from 'enzyme';

import { IpcEvents } from '../../../src/ipc-events';
import { Commands } from '../../../src/renderer/components/commands';
import { BisectHandler } from '../../../src/renderer/components/commands-bisect';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { StateMock } from '../../mocks/mocks';
import { overridePlatform, resetPlatform } from '../../utils';

jest.mock('../../../src/renderer/components/commands-runner', () => ({
  Runner: 'runner',
}));

jest.mock('../../../src/renderer/components/commands-version-chooser', () => ({
  VersionChooser: 'version-chooser',
}));

jest.mock('../../../src/renderer/components/commands-address-bar', () => ({
  AddressBar: 'address-bar',
}));

jest.mock('../../../src/renderer/components/commands-action-button', () => ({
  GistActionButton: 'action-button',
}));

describe('Commands component', () => {
  let store: StateMock;

  beforeEach(() => {
    overridePlatform('linux');
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  afterEach(() => {
    resetPlatform();
  });

  it('renders when system is darwin', () => {
    overridePlatform('darwin');
    const wrapper = shallow(<Commands appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when system not is darwin', () => {
    overridePlatform('win32');
    const wrapper = shallow(<Commands appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('can show the bisect command tools', () => {
    store.isBisectCommandShowing = true;
    const wrapper = shallow(<Commands appState={store as any} />);

    expect(wrapper.find(BisectHandler).length).toBe(1);
  });

  it('handleDoubleClick()', () => {
    const spy = jest.spyOn(ipcRendererManager, 'send');

    const wrapper = shallow(<Commands appState={store as any} />);
    const instance = wrapper.instance() as any;

    instance.handleDoubleClick({ target: {} });

    expect(spy).toHaveBeenCalledWith(IpcEvents.CLICK_TITLEBAR_MAC);
    spy.mockRestore();
  });

  it('handleDoubleClick() should not handle input tag', () => {
    const spy = jest.spyOn(ipcRendererManager, 'send');

    const wrapper = shallow(<Commands appState={store as any} />);
    const instance = wrapper.instance() as any;

    instance.handleDoubleClick({ target: { tagName: 'INPUT' } });

    expect(spy).toHaveBeenCalledTimes(0);
    spy.mockRestore();
  });

  it('show setting', () => {
    const wrapper = shallow(<Commands appState={store as any} />);

    wrapper.find(ControlGroup).at(0).find(Button).simulate('click');

    expect(store.toggleSettings).toHaveBeenCalled();
  });
});
