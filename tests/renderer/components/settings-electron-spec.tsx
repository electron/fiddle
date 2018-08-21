import { shallow } from 'enzyme';
import * as React from 'react';

import { ElectronSettings } from '../../../src/renderer/components/settings-electron';
import { ElectronReleaseChannel } from '../../../src/renderer/versions';
import { mockVersions } from '../../mocks/electron-versions';

describe('ElectronSettings component', () => {
  beforeEach(() => {
    this.store = {
      version: '2.0.1',
      versions: mockVersions,
      versionPagesToFetch: 2,
      versionsToShow: [ ElectronReleaseChannel.stable, ElectronReleaseChannel.beta ],
      downloadVersion: jest.fn(),
      removeVersion: jest.fn(),
      updateElectronVersions: jest.fn()
    };

    // Render all the states
    this.store.versions['2.0.2'].state = 'downloading';
    this.store.versions['2.0.1'].state = 'ready';
    this.store.versions['1.8.7'].state = 'unknown';
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

  describe('handleDownloadClick()', () => {
    it('kicks off an update of Electron versions', async () => {
      const wrapper = shallow(
        <ElectronSettings appState={this.store} />
      );
      const instance = wrapper.instance() as any;
      await instance.handleDownloadClick();

      expect(this.store.updateElectronVersions).toHaveBeenCalled();
    });
  });

  describe('handlePagesChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <ElectronSettings appState={this.store} />
      );
      const instance = wrapper.instance() as any;
      await instance.handlePagesChange({
        currentTarget: {
          value: '120'
        }
      });

      expect(this.store.versionPagesToFetch).toBe(4);
    });
  });

  describe('handleChannelChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <ElectronSettings appState={this.store} />
      );
      const instance = wrapper.instance() as any;
      await instance.handleChannelChange({
        currentTarget: {
          id: ElectronReleaseChannel.stable,
          checked: false
        }
      });

      await instance.handleChannelChange({
        currentTarget: {
          id: ElectronReleaseChannel.nightly,
          checked: true
        }
      });

      expect(this.store.versionsToShow).toEqual([
        ElectronReleaseChannel.beta,
        ElectronReleaseChannel.nightly
      ]);
    });
  });
});
