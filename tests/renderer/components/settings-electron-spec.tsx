import { shallow } from 'enzyme';
import * as React from 'react';

import { ElectronSettings } from '../../../src/renderer/components/settings-electron';
import { mockVersions } from '../../mocks/electron-versions';

describe('ElectronSettings component', () => {
  beforeEach(() => {
    this.store = {
      version: '2.0.1',
      versions: mockVersions,
      downloadVersion: jest.fn(),
      removeVersion: jest.fn()
    };
  });

  it('renders', () => {
    const wrapper = shallow(
      <ElectronSettings appState={this.store} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('handles the deleteAll()', async () => {
    const wrapper = shallow(
      <ElectronSettings appState={this.store} />
    );
    const instance = wrapper.instance() as any;
    await instance.handleDeleteAll();

    expect(this.store.removeVersion).toHaveBeenCalledTimes(2);
  });

  it('handles the downloadAll()', async () => {
    const wrapper = shallow(
      <ElectronSettings appState={this.store} />
    );
    const instance = wrapper.instance() as any;
    await instance.handleDownloadAll();

    expect(this.store.downloadVersion).toHaveBeenCalled();
  });
});
