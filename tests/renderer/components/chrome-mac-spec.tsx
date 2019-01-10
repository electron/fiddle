import * as electron from 'electron';
import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { ChromeMac } from '../../../src/renderer/components/chrome-mac';
import { MockBrowserWindow } from '../../mocks/browser-window';
import { overridePlatform, resetPlatform } from '../../utils';

describe('Chrome-Mac component', () => {
  const store: any = {};

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
    it('should minimize the window if AppleActionOnDoubleClick is minimize', () => {
      const wrapper = mount(<ChromeMac appState={store} />);
      const chrome = wrapper.instance() as ChromeMac;
      const fakeWindow = new MockBrowserWindow();
      (electron.remote.systemPreferences.getUserDefault as jest.Mock).mockReturnValue('Minimize');
      (electron.remote.getCurrentWindow as jest.Mock).mockReturnValue(fakeWindow);

      chrome.handleDoubleClick();

      expect(electron.remote.systemPreferences.getUserDefault).toHaveBeenCalled();
      expect(fakeWindow.minimize).toHaveBeenCalled();
      expect(fakeWindow.maximize).not.toHaveBeenCalled();
      expect(fakeWindow.unmaximize).not.toHaveBeenCalled();
    });

    it('should maximize the window if AppleActionOnDoubleClick is maximize and the window is not maximized', () => {
      const wrapper = mount(<ChromeMac appState={store} />);
      const chrome = wrapper.instance() as ChromeMac;
      const fakeWindow = new MockBrowserWindow();
      (electron.remote.systemPreferences.getUserDefault as jest.Mock).mockReturnValue('Maximize');
      (electron.remote.getCurrentWindow as jest.Mock).mockReturnValue(fakeWindow);
      fakeWindow.isMaximized.mockReturnValue(false);

      chrome.handleDoubleClick();

      expect(electron.remote.systemPreferences.getUserDefault).toHaveBeenCalled();
      expect(fakeWindow.minimize).not.toHaveBeenCalled();
      expect(fakeWindow.maximize).toHaveBeenCalled();
      expect(fakeWindow.unmaximize).not.toHaveBeenCalled();
    });

    it('should unmaximize the window if AppleActionOnDoubleClick is maximize and the window is maximized', () => {
      const wrapper = mount(<ChromeMac appState={store} />);
      const chrome = wrapper.instance() as ChromeMac;
      const fakeWindow = new MockBrowserWindow();
      (electron.remote.systemPreferences.getUserDefault as jest.Mock).mockReturnValue('Maximize');
      (electron.remote.getCurrentWindow as jest.Mock).mockReturnValue(fakeWindow);
      fakeWindow.isMaximized.mockReturnValue(true);

      chrome.handleDoubleClick();

      expect(electron.remote.systemPreferences.getUserDefault).toHaveBeenCalled();
      expect(fakeWindow.minimize).not.toHaveBeenCalled();
      expect(fakeWindow.maximize).not.toHaveBeenCalled();
      expect(fakeWindow.unmaximize).toHaveBeenCalled();
    });

    it('should do nothingif AppleActionOnDoubleClick is an unknown value', () => {
      const wrapper = mount(<ChromeMac appState={store} />);
      const chrome = wrapper.instance() as ChromeMac;
      const fakeWindow = new MockBrowserWindow();
      (electron.remote.systemPreferences.getUserDefault as jest.Mock).mockReturnValue('Nonsense');
      (electron.remote.getCurrentWindow as jest.Mock).mockReturnValue(fakeWindow);

      chrome.handleDoubleClick();

      expect(electron.remote.systemPreferences.getUserDefault).toHaveBeenCalled();
      expect(fakeWindow.minimize).not.toHaveBeenCalled();
      expect(fakeWindow.maximize).not.toHaveBeenCalled();
      expect(fakeWindow.unmaximize).not.toHaveBeenCalled();
    });
  });
});
