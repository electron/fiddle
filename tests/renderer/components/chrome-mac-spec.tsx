import { mount, shallow } from 'enzyme';
import { MockState } from '../../mocks/state';
import * as React from 'react';
import { IpcEvents } from '../../../src/ipc-events';

import { ChromeMac } from '../../../src/renderer/components/chrome-mac';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { overridePlatform, resetPlatform } from '../../utils';

// mock out parts of appState that touch the real world
jest.mock('extract-zip');
jest.mock('fs-extra');

describe('Chrome-Mac component', () => {
  const appState: any = new MockState();

  afterEach(() => resetPlatform());

  it('renders', () => {
    overridePlatform('darwin');

    const wrapper = shallow(<ChromeMac appState={appState} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders nothing on win32', () => {
    overridePlatform('win32');

    const wrapper = shallow(<ChromeMac appState={appState} />);
    expect(wrapper.html()).toBe(null);
  });

  describe('handleDoubleClick', () => {
    it('should send a message to the main process', () => {
      const wrapper = mount(<ChromeMac appState={appState} />);
      const chrome = wrapper.instance() as ChromeMac;
      ipcRendererManager.send = jest.fn();

      chrome.handleDoubleClick();
      expect(ipcRendererManager.send).toHaveBeenCalledWith(
        IpcEvents.CLICK_TITLEBAR_MAC,
      );
    });
  });
});
