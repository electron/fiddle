import * as React from 'react';

import { InstallState } from '@electron/fiddle-core';
import { mount, shallow } from 'enzyme';

import {
  ElectronReleaseChannel,
  RunnableVersion,
  VersionSource,
} from '../../../src/interfaces';
import { ElectronSettings } from '../../../src/renderer/components/settings-electron';
import { AppState } from '../../../src/renderer/state';
import * as versions from '../../../src/renderer/versions';
import { disableDownload } from '../../../src/utils/disable-download';
import { AppMock, StateMock, VersionsMock } from '../../mocks/mocks';

jest.mock('../../../src/utils/disable-download.ts');

describe('ElectronSettings component', () => {
  let store: StateMock;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new VersionsMock());
    ({ state: store } = (window.ElectronFiddle.app as unknown) as AppMock);

    store.initVersions('2.0.1', { ...mockVersions });
    store.channelsToShow = [
      ElectronReleaseChannel.stable,
      ElectronReleaseChannel.beta,
    ];

    // Render all the states
    let i = 0;
    store.versionsToShow[i++].state = InstallState.installed;
    store.versionsToShow[i++].state = InstallState.downloading;
    store.versionsToShow[i++].state = InstallState.missing;
    store.versionsToShow[i++].state = InstallState.installing;
  });

  it('renders', () => {
    const spy = jest
      .spyOn(versions, 'getOldestSupportedMajor')
      .mockReturnValue(9);

    const moreVersions: RunnableVersion[] = [
      {
        source: VersionSource.local,
        state: InstallState.installed,
        version: '3.0.0',
      },
      {
        source: VersionSource.remote,
        state: InstallState.installed,
        version: '3.0.0-nightly.1',
      },
    ];

    for (const ver of moreVersions) {
      store.versions[ver.version] = ver;
      store.versionsToShow.unshift(ver);
    }

    const wrapper = shallow(
      <ElectronSettings appState={(store as unknown) as AppState} />,
    );
    expect(wrapper).toMatchSnapshot();

    spy.mockRestore();
  });

  it('handles removing a version', async () => {
    store.versions['3.0.0-nightly.1'] = {
      state: InstallState.installed,
      version: '3.0.0-nightly.1',
      source: VersionSource.local,
    };

    store.versions['3.0.0'] = {
      state: InstallState.installed,
      version: '3.0.0',
      source: VersionSource.local,
    };

    const wrapper = mount(
      <ElectronSettings appState={(store as unknown) as AppState} />,
    );

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
      state: InstallState.missing,
      version,
    };
    store.versions = { version: ver };
    store.versionsToShow = [ver];

    const wrapper = mount(
      <ElectronSettings appState={(store as unknown) as AppState} />,
    );

    wrapper
      .find('.electron-versions-table .bp3-button')
      .first()
      .simulate('click');

    expect(store.downloadVersion).toHaveBeenCalledTimes(1);
  });

  it('handles missing local versions', () => {
    const version = '99999.0.0';
    const ver = {
      source: VersionSource.local,
      state: InstallState.missing,
      version,
    };
    store.versions = { version: ver };
    store.versionsToShow = [ver];

    const wrapper = mount(
      <ElectronSettings appState={(store as unknown) as AppState} />,
    );

    wrapper
      .find('.electron-versions-table .bp3-button')
      .first()
      .simulate('click');

    expect(store.removeVersion).toHaveBeenCalledTimes(1);
  });

  it('handles the deleteAll()', async () => {
    const wrapper = shallow(
      <ElectronSettings appState={(store as unknown) as AppState} />,
    );
    const instance = wrapper.instance() as any;
    await instance.handleDeleteAll();

    expect(store.removeVersion).toHaveBeenCalledTimes(mockVersionsArray.length);
  });

  it('handles the downloadAll()', async () => {
    const wrapper = shallow(
      <ElectronSettings appState={(store as unknown) as AppState} />,
    );
    const instance = wrapper.instance() as any;
    await instance.handleDownloadAll();

    expect(store.downloadVersion).toHaveBeenCalled();
  });

  describe('handleUpdateElectronVersions()', () => {
    it('kicks off an update of Electron versions', async () => {
      const wrapper = shallow(
        <ElectronSettings appState={(store as unknown) as AppState} />,
      );
      const instance = wrapper.instance() as any;
      await instance.handleUpdateElectronVersions();

      expect(store.updateElectronVersions).toHaveBeenCalled();
    });
  });

  describe('handleAddVersion()', () => {
    it('toggles the add version dialog', () => {
      const wrapper = shallow(
        <ElectronSettings appState={(store as unknown) as AppState} />,
      );
      const instance = wrapper.instance() as any;
      instance.handleAddVersion();

      expect(store.toggleAddVersionDialog).toHaveBeenCalled();
    });
  });

  describe('handleStateChange()', () => {
    it('toggles remote versions', async () => {
      const id = 'showUndownloadedVersions';
      for (const checked of [true, false]) {
        const wrapper = shallow(
          <ElectronSettings appState={(store as unknown) as AppState} />,
        );
        const instance = wrapper.instance() as any;
        await instance.handleStateChange({
          currentTarget: { checked, id },
        });
        expect(store[id]).toBe(checked);
      }
    });
  });

  describe('handleShowObsoleteChange()', () => {
    it('toggles obsolete versions', async () => {
      const id = 'showObsoleteVersions';
      for (const checked of [true, false]) {
        const wrapper = shallow(
          <ElectronSettings appState={(store as unknown) as AppState} />,
        );
        const instance = wrapper.instance() as any;
        await instance.handleShowObsoleteChange({
          currentTarget: { checked, id },
        });
        expect(store[id]).toBe(checked);
      }
    });
  });

  describe('handleChannelChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <ElectronSettings appState={(store as unknown) as AppState} />,
      );
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

  describe('disableDownload()', () => {
    it('disables download buttons where return values are true', () => {
      (disableDownload as jest.Mock).mockReturnValue(true);

      const version = '3.0.0';
      const ver = {
        source: VersionSource.remote,
        state: InstallState.missing,
        version,
      };

      store.versions = { version: ver };

      store.versionsToShow = [ver, { ...ver }, { ...ver }];

      const wrapper = shallow(
        <ElectronSettings appState={(store as unknown) as AppState} />,
      );

      expect(wrapper.find('.disabled-version')).toHaveLength(3);
    });
  });
});
