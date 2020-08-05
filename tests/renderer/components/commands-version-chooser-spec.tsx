import { mount, shallow } from 'enzyme';
import * as React from 'react';

import { VersionSource, VersionState } from '../../../src/interfaces';
import { VersionChooser } from '../../../src/renderer/components/commands-version-chooser';
import { ElectronReleaseChannel } from '../../../src/renderer/versions';
import { mockVersions } from '../../mocks/electron-versions';

const { unknown } = VersionState;
const { remote } = VersionSource;

describe('VersionSelect component', () => {
  let store: any;

  const mockVersion1 = {
    source: remote,
    state: unknown,
    version: '1.0.0',
  };

  const mockVersion2 = {
    source: remote,
    state: unknown,
    version: '3.0.0-unsupported',
  };

  beforeEach(() => {
    const versions = {
      ...mockVersions,
      '3.1.3': undefined,
      '1.0.0': { ...mockVersion1 },
      '3.0.0-unsupported': { ...mockVersion2 },
    };

    store = {
      version: '2.0.2',
      versionsToShow: Object.values(versions).filter((v) => !!v),
      versions,
      channelsToShow: [
        ElectronReleaseChannel.stable,
        ElectronReleaseChannel.beta,
      ],
      statesToShow: [VersionState.ready, VersionState.downloading],
      setVersion: jest.fn(),
      get currentElectronVersion() {
        return mockVersions['2.0.2'];
      },
    };
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
    expect(store.setVersion).toHaveBeenCalledWith(mockVersion1.version);
  });
});
