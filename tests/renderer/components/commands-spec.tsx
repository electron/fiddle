import * as React from 'react';
import { shallow } from 'enzyme';

import { Commands } from '../../../src/renderer/components/commands';
import { BisectHandler } from '../../../src/renderer/components/commands-bisect';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { IpcEvents } from '../../../src/ipc-events';

import { StateMock } from '../../mocks/mocks';

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
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  it('renders', () => {
    const wrapper = shallow(<Commands appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('show bisect command', () => {
    store.isBisectCommandShowing = true;
    const wrapper = shallow(<Commands appState={store as any} />);

    expect(wrapper.find(BisectHandler).length).toBe(1);
  });

  it('handleDoubleClick()', () => {
    const spy = jest.spyOn(ipcRendererManager, 'send');

    const wrapper = shallow(<Commands appState={store as any} />);
    const instance = wrapper.instance() as any;

    instance.handleDoubleClick();

    expect(spy).toHaveBeenCalledWith(IpcEvents.CLICK_TITLEBAR_MAC);
    spy.mockRestore();
  });
});
