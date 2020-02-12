import { shallow } from 'enzyme';
import * as React from 'react';

import { ElectronVersionSource, ElectronVersionState } from '../../../src/interfaces';
import { VersionChooser } from '../../../src/renderer/components/commands-version-chooser';
import { ElectronReleaseChannel } from '../../../src/renderer/versions';
import { mockVersions } from '../../mocks/electron-versions';

const { ready, unknown, downloading } = ElectronVersionState;
const { remote, local } = ElectronVersionSource;

describe('VersionSelect component', () => {
  let store: any;

  const mockVersion1 = {
    source: remote,
    state: unknown,
    version: '1.0.0'
  };

  const mockVersion2 = {
    source: remote,
    state: unknown,
    version: '3.0.0-unsupported'
  };

  beforeEach(() => {
    store = {
      version: '2.0.2',
      versions: {
        ...mockVersions,
        '3.1.3': undefined,
        '1.0.0': { ...mockVersion1 },
        '3.0.0-unsupported': { ...mockVersion2 }
      },
      channelsToShow: [ ElectronReleaseChannel.stable, ElectronReleaseChannel.beta ],
      statesToShow: [ ElectronVersionState.ready, ElectronVersionState.downloading ],
      setVersion: jest.fn(),
      get currentElectronVersion() {
        return mockVersions['2.0.2'];
      }
    };
  });

  it('renders', () => {
    const wrapper = shallow(
      <VersionChooser appState={store} />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
