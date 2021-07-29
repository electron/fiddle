import { mount, shallow } from 'enzyme';
import * as React from 'react';

import {
  ElectronReleaseChannel,
  RunnableVersion,
  VersionState,
} from '../../../src/interfaces';
import { VersionChooser } from '../../../src/renderer/components/commands-version-chooser';
import { StateMock, VersionsMock } from '../../mocks/mocks';

const { unknown } = VersionState;

describe('VersionSelect component', () => {
  let store: StateMock;

  const mockVersion1: RunnableVersion = {
    source: 'remote',
    state: unknown,
    version: '1.0.0',
  } as const;

  const mockVersion2: RunnableVersion = {
    source: 'remote',
    state: unknown,
    version: '3.0.0-unsupported',
  } as const;

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);

    const { mockVersions } = new VersionsMock();
    store.initVersions('2.0.2', {
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
    const wrapper = shallow(<VersionChooser appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('selects a new version', () => {
    const wrapper = mount(<VersionChooser appState={store as any} />);

    const onVersionSelect: any = wrapper
      .find('VersionSelect')
      .prop('onVersionSelect');
    onVersionSelect(mockVersion1);
    expect(store.setVersion).toHaveBeenCalledWith(mockVersion1.version);
  });
});
