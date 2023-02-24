import * as React from 'react';

import { InstallState } from '@electron/fiddle-core';
import { mount, shallow } from 'enzyme';

import { ElectronReleaseChannel, VersionSource } from '../../../src/interfaces';
import { VersionChooser } from '../../../src/renderer/components/commands-version-chooser';
import { AppState } from '../../../src/renderer/state';
import { StateMock, VersionsMock } from '../../mocks/mocks';

const { missing } = InstallState;
const { remote } = VersionSource;

describe('VersionSelect component', () => {
  let store: AppState;

  const mockVersion1 = {
    source: remote,
    state: missing,
    version: '1.0.0',
  };

  const mockVersion2 = {
    source: remote,
    state: missing,
    version: '3.0.0-unsupported',
  };

  beforeEach(() => {
    ({ state: store } = window.ElectronFiddle.app);

    const { mockVersions } = new VersionsMock();
    ((store as unknown) as StateMock).initVersions('2.0.2', {
      ...mockVersions,
      '1.0.0': { ...mockVersion1 },
      '3.0.0-unsupported': { ...mockVersion2 },
    });

    store.channelsToShow = [
      ElectronReleaseChannel.stable,
      ElectronReleaseChannel.beta,
    ];
  });

  it('renders', () => {
    const wrapper = shallow(<VersionChooser appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('selects a new version', () => {
    const wrapper = mount(<VersionChooser appState={store} />);

    const onVersionSelect: any = wrapper
      .find('VersionSelect')
      .prop('onVersionSelect');
    onVersionSelect(mockVersion1);
    expect(store.setVersion as jest.Mock).toHaveBeenCalledWith(
      mockVersion1.version,
    );
  });
});
