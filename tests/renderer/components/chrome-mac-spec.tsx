import { mount, shallow } from 'enzyme';
import { StateMock } from '../../mocks/state';
import * as React from 'react';
import { IpcEvents } from '../../../src/ipc-events';

import { ChromeMac } from '../../../src/renderer/components/chrome-mac';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { overridePlatform, resetPlatform } from '../../utils';

describe('Chrome-Mac component', () => {
  const store: any = new StateMock();

  afterEach(() => resetPlatform());

  it('renders', () => {
    overridePlatform('darwin');

    const wrapper = shallow(<ChromeMac appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders nothing on win32', () => {
    overridePlatform('win32');

    const wrapper = shallow(<ChromeMac appState={store} />);
    expect(wrapper.html()).toBe(null);
  });

  describe('handleDoubleClick', () => {
    it('should send a message to the main process', () => {
      const wrapper = mount(<ChromeMac appState={store} />);
      const chrome = wrapper.instance() as ChromeMac;
      ipcRendererManager.send = jest.fn();

      chrome.handleDoubleClick();
      expect(ipcRendererManager.send).toHaveBeenCalledWith(
        IpcEvents.CLICK_TITLEBAR_MAC,
      );
    });
  });
});
