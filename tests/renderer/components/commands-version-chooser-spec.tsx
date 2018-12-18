import { shallow } from 'enzyme';
import * as React from 'react';

import { VersionChooser } from '../../../src/renderer/components/commands-version-chooser';
import { ElectronReleaseChannel } from '../../../src/renderer/versions';
import { mockVersions } from '../../mocks/electron-versions';

describe('VersionChooser component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      versions: mockVersions,
      versionsToShow: [ ElectronReleaseChannel.stable, ElectronReleaseChannel.beta ],
      setVersion: jest.fn()
    };
  });

  it('renders', () => {
    const wrapper = shallow(<VersionChooser appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a change appropriately', () => {
    const wrapper = shallow(<VersionChooser appState={store} />);
    const instance: VersionChooser = wrapper.instance() as any;

    instance.onItemSelect({ version: 'v2.0.1' } as any);

    expect(store.setVersion).toHaveBeenCalledWith('v2.0.1');
  });
});
