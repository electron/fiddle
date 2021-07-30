import { mount, shallow } from 'enzyme';
import * as React from 'react';

import {
  ElectronReleaseChannel,
  RunnableVersion,
} from '../../../src/interfaces';
import * as versions from '../../../src/renderer/versions';
import { ElectronSettings } from '../../../src/renderer/components/settings-electron';
import { StateMock, VersionsMock } from '../../mocks/mocks';

describe('ElectronSettings component', () => {
  let store: StateMock;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new VersionsMock());
    ({ state: store } = (window as any).ElectronFiddle.app);

    store.initVersions('2.0.1', { ...mockVersions });
    store.channelsToShow = ['Stable', 'Beta'];

    // Render all the states
    let i = 0;
    store.versionsToShow[i++].state = 'installed';
    store.versionsToShow[i++].state = 'downloading';
    store.versionsToShow[i++].state = 'absent';
    store.versionsToShow[i++].state = 'installing';
  });

  it('renders', () => {
    const spy = jest
      .spyOn(versions, 'getOldestSupportedMajor')
      .mockReturnValue(9);

    const moreVersions: RunnableVersion[] = [
      {
        source: 'local',
        state: 'installed',
        version: '3.0.0',
      },
      {
        source: 'remote',
        state: 'installed',
        version: '3.0.0-nightly.1',
      },
    ];

    for (const ver of moreVersions) {
      store.versions[ver.version] = ver;
      store.versionsToShow.unshift(ver);
    }

    const wrapper = shallow(<ElectronSettings appState={store as any} />);
    expect(wrapper).toMatchSnapshot();

    spy.mockRestore();
  });

  it('handles removing a version', async () => {
    store.versions['3.0.0-nightly.1'] = {
      state: 'installed',
      version: '3.0.0-nightly.1',
      source: 'local',
    };

    store.versions['3.0.0'] = {
      state: 'installed',
      version: '3.0.0',
      source: 'local',
    };

    const wrapper = mount(<ElectronSettings appState={store as any} />);

    wrapper
      .find('.electron-versions-table .bp3-button')
      .first()
      .simulate('click');

    expect(store.removeVersion).toHaveBeenCalledTimes(1);
  });

  it('handles downloading a version', async () => {
    const version = '3.0.0';
    const ver: RunnableVersion = {
      source: 'remote',
      state: 'absent',
      version,
    } as const;
    store.versions = { version: ver };
    store.versionsToShow = [ver];

    const wrapper = mount(<ElectronSettings appState={store as any} />);

    wrapper
      .find('.electron-versions-table .bp3-button')
      .first()
      .simulate('click');

    expect(store.downloadVersion).toHaveBeenCalledTimes(1);
  });

  it('handles missing local versions', () => {
    const version = '99999.0.0';
    const ver: RunnableVersion = {
      source: 'local',
      state: 'absent',
      version,
    } as const;
    store.versions = { version: ver };
    store.versionsToShow = [ver];

    const wrapper = mount(<ElectronSettings appState={store as any} />);

    wrapper
      .find('.electron-versions-table .bp3-button')
      .first()
      .simulate('click');

    expect(store.removeVersion).toHaveBeenCalledTimes(1);
  });

  it('handles the deleteAll()', async () => {
    const wrapper = shallow(<ElectronSettings appState={store as any} />);
    const instance = wrapper.instance() as any;
    await instance.handleDeleteAll();

    expect(store.removeVersion).toHaveBeenCalledTimes(mockVersionsArray.length);
  });

  it('handles the downloadAll()', async () => {
    const wrapper = shallow(<ElectronSettings appState={store as any} />);
    const instance = wrapper.instance() as any;
    await instance.handleDownloadAll();

    expect(store.downloadVersion).toHaveBeenCalled();
  });

  describe('handleDownloadClick()', () => {
    it('kicks off an update of Electron versions', async () => {
      const wrapper = shallow(<ElectronSettings appState={store as any} />);
      const instance = wrapper.instance() as any;
      await instance.handleDownloadClick();

      expect(store.updateElectronVersions).toHaveBeenCalled();
    });
  });

  describe('handleAddVersion()', () => {
    it('toggles the add version dialog', () => {
      const wrapper = shallow(<ElectronSettings appState={store as any} />);
      const instance = wrapper.instance() as any;
      instance.handleAddVersion();

      expect(store.toggleAddVersionDialog).toHaveBeenCalled();
    });
  });

  describe('handleStateChange()', () => {
    it('toggles remote versions', async () => {
      const id = 'showUndownloadedVersions';
      for (const checked of [true, false]) {
        const wrapper = shallow(<ElectronSettings appState={store as any} />);
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
        const wrapper = shallow(<ElectronSettings appState={store as any} />);
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
      const wrapper = shallow(<ElectronSettings appState={store as any} />);
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
          id: 'Stable',
          checked: false,
        },
      });

      await instance.handleChannelChange({
        currentTarget: {
          id: 'Nightly',
          checked: true,
        },
      });

      expect(store.channelsToShow).toEqual(['Beta', 'Nightly']);
    });
  });
});
