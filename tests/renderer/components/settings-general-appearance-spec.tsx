import { shallow } from 'enzyme';
import * as React from 'react';
const { shell } = require('electron');

import { AppearanceSettings } from '../../../src/renderer/components/settings-general-appearance';

jest.mock('fs-extra');
jest.mock('../../../src/utils/import', () => ({
  fancyImport: async (p: string) => require(p)
}));

describe('AppearanceSettings component', () => {
  beforeEach(() => {
    this.store = {};
  });

  it('renders', () => {
    const wrapper = shallow(
      <AppearanceSettings appState={this.store} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('attempts to open the folder on click', () => {
    const wrapper = shallow(
      <AppearanceSettings appState={this.store} />
    );
    const instance: AppearanceSettings = wrapper.instance() as any;
    instance.openThemeFolder = jest.fn();

    wrapper.find('#open-theme-folder').simulate('click');
    expect(instance.openThemeFolder).toHaveBeenCalled();
  });

  it('attempts to open the folder on openThemeFolder', async () => {
    const wrapper = shallow(
      <AppearanceSettings appState={this.store} />
    );
    const instance: AppearanceSettings = wrapper.instance() as any;
    await instance.openThemeFolder();

    expect(shell.showItemInFolder).toHaveBeenCalled();
  });

  it('handles an error in openThemeFolder()', async () => {
    const wrapper = shallow(
      <AppearanceSettings appState={this.store} />
    );
    const instance: AppearanceSettings = wrapper.instance() as any;
    (shell as any).showItemInFolder.mockImplementationOnce(() => {
      throw new Error('Bwap');
    });

    expect(await instance.openThemeFolder()).toBe(false);
  });
});
