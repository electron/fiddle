import { mount, shallow } from 'enzyme';
import * as React from 'react';

import {
  ElectronReleaseChannel,
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../../src/interfaces';
import { ElectronSettings } from '../../../src/renderer/components/settings-electron';
import { MockVersions } from '../../mocks/electron-versions';

describe('ElectronSettings component', () => {
  let store: any;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new MockVersions());

    store = {
      version: '2.0.1',
      versions: { ...mockVersions },
      channelsToShow: [
        ElectronReleaseChannel.stable,
        ElectronReleaseChannel.beta,
      ],
      showUndownloadedVersions: false,
      downloadVersion: jest.fn(),
      removeVersion: jest.fn(),
      updateElectronVersions: jest.fn(),
      toggleAddVersionDialog: jest.fn(),
      showChannels: jest.fn(),
      hideChannels: jest.fn(),
      versionsToShow: mockVersionsArray,
    };

    // Render all the states
    store.versions['2.0.2'].state = 'downloading';
    store.versions['2.0.1'].state = 'ready';
    store.versions['1.8.7'].state = 'unknown';
  });

  it('renders', () => {
    const moreVersions: RunnableVersion[] = [
      {
        source: VersionSource.local,
        state: VersionState.ready,
        version: '3.0.0',
      },
      {
        source: VersionSource.remote,
        state: VersionState.ready,
        version: '3.0.0-nightly.1',
      },
    ];

    for (const ver of moreVersions) {
      store.versions[ver.version] = ver;
      store.versionsToShow.unshift(ver);
    }

    const wrapper = shallow(<ElectronSettings appState={store} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('handles removing a version', async () => {
    store.versions['3.0.0-nightly.1'] = {
      state: VersionState.ready,
      version: '3.0.0-nightly.1',
      source: VersionSource.local,
    };

    store.versions['3.0.0'] = {
      state: VersionState.ready,
      version: '3.0.0',
      source: VersionSource.local,
    };

    const wrapper = mount(<ElectronSettings appState={store} />);

    wrapper
      .find('.electron-versions-table .bp3-button')
      .first()
      .simulate('click');

    expect(store.removeVersion).toHaveBeenCalledTimes(1);
  });

  it('handles downloading a version', async () => {
    const version = '3.0.0';
    const ver = {
      source: VersionSource.remote,
      state: VersionState.unknown,
      version,
    };
    store.versions = { version: ver };
    store.versionsToShow = [ver];

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

    expect(store.removeVersion).toHaveBeenCalledTimes(
      mockVersionsArray.length - 1,
    );
  });

  it('handles the downloadAll()', async () => {
    const wrapper = shallow(<ElectronSettings appState={store} />);
    const instance = wrapper.instance() as any;
    await instance.handleDownloadAll();

    expect(store.downloadVersion).toHaveBeenCalled();
  });

  describe('handleDownloadClick()', () => {
    it('kicks off an update of Electron versions', async () => {
      const wrapper = shallow(<ElectronSettings appState={store} />);
      const instance = wrapper.instance() as any;
      await instance.handleDownloadClick();

      expect(store.updateElectronVersions).toHaveBeenCalled();
    });
  });

  describe('handleAddVersion()', () => {
    it('toggles the add version dialog', () => {
      const wrapper = shallow(<ElectronSettings appState={store} />);
      const instance = wrapper.instance() as any;
      instance.handleAddVersion();

      expect(store.toggleAddVersionDialog).toHaveBeenCalled();
    });
  });

  describe('handleVersionChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<ElectronSettings appState={store} />);
      const instance = wrapper.instance() as any;
      await instance.handleStateChange({
        currentTarget: {
          id: 'showUndownloadedVersions',
          checked: true,
        },
      });

      expect(store.showUndownloadedVersions).toBe(true);
    });
  });

  describe('handleChannelChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<ElectronSettings appState={store} />);
      store.showChannels.mockImplementation((ids: ElectronReleaseChannel[]) =>
        store.channelsToShow.push(...ids),
      );
      store.hideChannels.mockImplementation(
        (ids: ElectronReleaseChannel[]) =>
          (store.channelsToShow = store.channelsToShow.filter(
            (id: ElectronReleaseChannel) => !ids.includes(id),
          )),
      );
      const instance = wrapper.instance() as any;
      await instance.handleChannelChange({
        currentTarget: {
          id: ElectronReleaseChannel.stable,
          checked: false,
        },
      });

      await instance.handleChannelChange({
        currentTarget: {
          id: ElectronReleaseChannel.nightly,
          checked: true,
        },
      });

      expect(store.channelsToShow).toEqual([
        ElectronReleaseChannel.beta,
        ElectronReleaseChannel.nightly,
      ]);
    });
  });
});
