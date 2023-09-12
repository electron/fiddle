import * as React from 'react';

import { Button, ControlGroup } from '@blueprintjs/core';
import { shallow } from 'enzyme';

import { Commands } from '../../../src/renderer/components/commands';
import { BisectHandler } from '../../../src/renderer/components/commands-bisect';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform, resetRendererPlatform } from '../../utils';

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
  let store: AppState;

  beforeEach(() => {
    overrideRendererPlatform('linux');
    ({ state: store } = window.app);
  });

  afterEach(() => {
    resetRendererPlatform();
  });

  it('renders when system is darwin', () => {
    overrideRendererPlatform('darwin');
    const wrapper = shallow(<Commands appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders when system not is darwin', () => {
    overrideRendererPlatform('win32');
    const wrapper = shallow(<Commands appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('can show the bisect command tools', () => {
    store.isBisectCommandShowing = true;
    const wrapper = shallow(<Commands appState={store} />);

    expect(wrapper.find(BisectHandler).length).toBe(1);
  });

  it('handleDoubleClick()', () => {
    const wrapper = shallow(<Commands appState={store} />);
    const instance: any = wrapper.instance();

    const tag = { tagName: 'DIV' };
    instance.handleDoubleClick({ target: tag, currentTarget: tag });

    expect(window.ElectronFiddle.macTitlebarClicked).toHaveBeenCalled();
  });

  it('handleDoubleClick() should not handle input tag', () => {
    const wrapper = shallow(<Commands appState={store} />);
    const instance: any = wrapper.instance();

    instance.handleDoubleClick({
      target: { tagName: 'INPUT' },
      currentTarget: { tagName: 'DIV' },
    });

    expect(window.ElectronFiddle.macTitlebarClicked).toHaveBeenCalledTimes(0);
  });

  it('show setting', () => {
    const wrapper = shallow(<Commands appState={store} />);

    wrapper.find(ControlGroup).at(0).find(Button).simulate('click');

    expect(store.toggleSettings).toHaveBeenCalled();
  });
});
