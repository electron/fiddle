import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { ElectronVersionSource, ElectronVersionState } from '../../../src/interfaces';
import { ElectronSettings } from '../../../src/renderer/components/settings-electron';
import { ElectronReleaseChannel } from '../../../src/renderer/versions';
import { mockVersions } from '../../mocks/electron-versions';

describe('ElectronSettings component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      version: '2.0.1',
      versions: { ...mockVersions },
      versionsToShow: [ ElectronReleaseChannel.stable, ElectronReleaseChannel.beta ],
      statesToShow: [ ElectronVersionState.ready, ElectronVersionState.downloading ],
      downloadVersion: jest.fn(),
      removeVersion: jest.fn(),
      updateElectronVersions: jest.fn(),
      toggleAddVersionDialog: jest.fn()
    };

    // Render all the states
    store.versions['2.0.2'].state = 'downloading';
    store.versions['2.0.1'].state = 'ready';
    store.versions['1.8.7'].state = 'unknown';
  });

  it('renders', () => {
    store.versions['3.0.0-nightly.1'] = {
      state: ElectronVersionState.ready,
      version: '3.0.0-nightly.1',
      source: ElectronVersionSource.local
    };

    store.versions['3.0.0'] = {
      state: ElectronVersionState.ready,
      version: '3.0.0',
      source: ElectronVersionSource.local
    };

    const wrapper = shallow(<ElectronSettings appState={store} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('handles removing a version', async () => {
    store.versions['3.0.0-nightly.1'] = {
      state: ElectronVersionState.ready,
      version: '3.0.0-nightly.1',
      source: ElectronVersionSource.local
    };

    store.versions['3.0.0'] = {
      state: ElectronVersionState.ready,
      version: '3.0.0',
      source: ElectronVersionSource.local
    };

    const wrapper = mount(<ElectronSettings appState={store} />);

    wrapper
      .find('.electron-versions-table .bp3-button')
      .first()
      .simulate('click');

    expect(store.removeVersion).toHaveBeenCalledTimes(1);
  });

  it('handles downloading a version', async () => {
    store.versions = {
      '3.0.0': {
        state: ElectronVersionState.unknown,
        version: '3.0.0',
        source: ElectronVersionSource.remote
      }
    };

    store.statesToShow.push(ElectronVersionState.unknown);

    const wrapper = mount(<ElectronSettings appState={store} />);

    wrapper
      .find('.electron-versions-table .bp3-button')
      .first()
      .simulate('click');

    expect(store.downloadVersion).toHaveBeenCalledTimes(1);
  });

  it('handles the deleteAll()', async () => {
    const wrapper = shallow(<ElectronSettings appState={store} />);
    const instance = wrapper.instance() as any;
    await instance.handleDeleteAll();

    expect(store.removeVersion).toHaveBeenCalledTimes(2);
  });

  it('handles the downloadAll()', async () => {
    const wrapper = shallow(
      <ElectronSettings appState={store} />
    );
    const instance = wrapper.instance() as any;
    await instance.handleDownloadAll();

    expect(store.downloadVersion).toHaveBeenCalled();
  });

  describe('handleDownloadClick()', () => {
    it('kicks off an update of Electron versions', async () => {
      const wrapper = shallow(
        <ElectronSettings appState={store} />
      );
      const instance = wrapper.instance() as any;
      await instance.handleDownloadClick();

      expect(store.updateElectronVersions).toHaveBeenCalled();
    });
  });

  describe('handleAddVersion()', () => {
    it('toggles the add version dialog', () => {
      const wrapper = shallow(
        <ElectronSettings appState={store} />
      );
      const instance = wrapper.instance() as any;
      instance.handleAddVersion();

      expect(store.toggleAddVersionDialog).toHaveBeenCalled();
    });
  });

  describe('handleVersionChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <ElectronSettings appState={store} />
      );
      const instance = wrapper.instance() as any;
      await instance.handleStateChange({
        currentTarget: {
          id: ElectronVersionState.ready,
          checked: false
        }
      });

      await instance.handleStateChange({
        currentTarget: {
          id: ElectronVersionState.unknown,
          checked: true
        }
      });

      expect(store.statesToShow).toEqual([
        ElectronVersionState.downloading,
        ElectronVersionState.unknown
      ]);
    });
  });

  describe('handleChannelChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <ElectronSettings appState={store} />
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

      expect(store.versionsToShow).toEqual([
        ElectronReleaseChannel.beta,
        ElectronReleaseChannel.nightly
      ]);
    });
  });
});
